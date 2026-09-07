//! WASM pixel kernels for the RealESRGAN worker (Hebel E5).
//!
//! Only the feathered tile compose lives here — the one hot loop whose
//! buffers are pure frame temporaries (no lifetime constraints, unlike tile
//! extraction outputs, which onnxruntime-web may still read asynchronously).
//! Own linear memory, zero dependencies, no wasm-bindgen: all traffic is
//! byte offsets into the exported `memory`.
//!
//! Protocol (all synchronous; NOTHING may hold a view across calls, because
//! exec can grow memory and detach earlier views — JS re-acquires views from
//! `memory.buffer` after every call):
//!
//! ```text
//! stage_ptr(kind, len_bytes) -> u32 offset   // kind 0 = batch f32, 1 = tiles u32
//! compose_exec(out_w, out_h, feather, ntiles, tile_out_w, tile_out_h)
//! compose_output_ptr() -> u32 offset         // RGBA8 staging, len = output_len
//! compose_output_len() -> u32 bytes
//! ```
//!
//! `tiles` is flat u32 `[x, y] * n` in OUTPUT pixels. The batch is planar
//! f32 `[B, 3, tile_out_h, tile_out_w]` (4x tile dims). Math is exactly the
//! JS `composeTilesToRgba8` formula (integer ramps, weight = min(fx, fy),
//! weighted average, clamp + round-half-up pack).
//!
//! Vectorization strategy: one scalar source over disjoint BORROWED slices
//! (no raw-pointer arithmetic in the hot loops). The borrow checker proves
//! the planes disjoint, so LLVM auto-vectorizes with +simd128 on wasm32 and
//! SSE/AVX on x86-64 from the same source. Unsafe exists only at the ABI
//! boundary (offset -> slice, lengths validated once). FMA contraction is
//! platform dependent — the gate is PSNR (see tests/pixels-wasm.test.ts),
//! with byte-exactness on integer-exact fixtures.
//!
//! Single-threaded worker: one global Composer behind `static mut`, no
//! reentrancy (calls never await).

struct Composer {
    acc: Vec<f32>,
    weights: Vec<f32>,
    rgba: Vec<u8>,
    fx: Vec<f32>,
    batch_stage: Vec<f32>,
    tiles_stage: Vec<u32>,
    out_w: u32,
    out_h: u32,
}

static mut COMPOSER: Option<Composer> = None;

fn composer() -> &'static mut Composer {
    // SAFETY: single-threaded worker realm; entry points are synchronous and
    // never reenter (no awaits, no callbacks into JS mid-call).
    #[allow(static_mut_refs)]
    unsafe {
        if COMPOSER.is_none() {
            COMPOSER = Some(Composer {
                acc: Vec::new(),
                weights: Vec::new(),
                rgba: Vec::new(),
                fx: Vec::new(),
                batch_stage: Vec::new(),
                tiles_stage: Vec::new(),
                out_w: 0,
                out_h: 0,
            });
        }
        COMPOSER.as_mut().unwrap()
    }
}

/// Integer-exact feather ramp, mirroring JS
/// `Math.min(Math.min(i, length - 1 - i) + 1, featherWindow)`.
#[inline(always)]
fn ramp_value(i: u32, len: u32, feather: u32) -> f32 {
    debug_assert!(len >= 1);
    i.min(len - 1 - i).saturating_add(1).min(feather) as f32
}

/// Stage `len_bytes` of input in the module memory, return its byte offset.
/// Contents are undefined until JS writes them (fresh views required).
#[no_mangle]
pub extern "C" fn stage_ptr(kind: u32, len_bytes: u32) -> u32 {
    let c = composer();
    match kind {
        0 => {
            let n = (len_bytes / 4) as usize;
            c.batch_stage.resize(n, 0.0);
            c.batch_stage.as_ptr() as u32
        }
        _ => {
            let n = (len_bytes / 4) as usize;
            c.tiles_stage.resize(n, 0);
            c.tiles_stage.as_ptr() as u32
        }
    }
}

/// Accumulate one tile into disjoint plane/weight slices. All slices are
/// caller-borrowed (disjoint by construction), so the inner loops are the
/// canonical auto-vectorize shape on every target.
fn accumulate_tile(
    mut acc_planes: [&mut [f32]; 3],
    weights: &mut [f32],
    tile_rgb: &[f32],
    fx: &mut [f32],
    base_x: usize,
    base_y: usize,
    up_w: usize,
    up_h: usize,
    out_w: usize,
    feather: u32,
) {
    debug_assert!(tile_rgb.len() >= 3 * up_w * up_h);
    debug_assert!(fx.len() >= up_w);
    for (col, f) in fx.iter_mut().enumerate().take(up_w) {
        *f = ramp_value(col as u32, up_w as u32, feather);
    }
    let fx = &fx[..up_w];
    for row in 0..up_h {
        let wy = ramp_value(row as u32, up_h as u32, feather);
        let src_row = row * up_w;
        let out_row = (base_y + row) * out_w + base_x;
        for (ch, acc_plane) in acc_planes.iter_mut().enumerate() {
            let rgb_row = &tile_rgb[ch * up_w * up_h + src_row..ch * up_w * up_h + src_row + up_w];
            let acc_row = &mut acc_plane[out_row..out_row + up_w];
            for (a, (r, f)) in acc_row.iter_mut().zip(rgb_row.iter().zip(fx.iter())) {
                let w = if *f < wy { *f } else { wy };
                *a += *r * w;
            }
        }
        let wsum_row = &mut weights[out_row..out_row + up_w];
        for (s, f) in wsum_row.iter_mut().zip(fx.iter()) {
            let w = if *f < wy { *f } else { wy };
            *s += w;
        }
    }
}

/// Run the full compose over the staged batch + tile descs. Sizes the
/// scratch (zeroed) and packs RGBA8 into the output staging.
#[no_mangle]
pub extern "C" fn compose_exec(
    out_w: u32,
    out_h: u32,
    feather: u32,
    ntiles: u32,
    tile_out_w: u32,
    tile_out_h: u32,
) {
    let c = composer();
    c.out_w = out_w;
    c.out_h = out_h;
    let out_pixels = (out_w as usize) * (out_h as usize);
    c.acc.resize(3 * out_pixels, 0.0);
    c.acc.fill(0.0);
    c.weights.resize(out_pixels, 0.0);
    c.weights.fill(0.0);
    c.rgba.resize(4 * out_pixels, 0);
    let tile_pixels = (tile_out_w as usize) * (tile_out_h as usize);
    // Bounds validated once here; everything below is safe borrowed slices.
    assert!(c.batch_stage.len() >= (ntiles as usize) * 3 * tile_pixels);
    assert!(c.tiles_stage.len() >= (ntiles as usize) * 2);
    let max_fx = tile_out_w as usize;
    c.fx.resize(max_fx.max(1), 0.0);
    for b in 0..(ntiles as usize) {
        let tx = c.tiles_stage[b * 2] as usize;
        let ty = c.tiles_stage[b * 2 + 1] as usize;
        assert!(tx + (tile_out_w as usize) <= out_w as usize);
        assert!(ty + (tile_out_h as usize) <= out_h as usize);
        // Split disjoint borrows up front: borrowck proves the planes apart.
        let (acc_r, rest) = c.acc.split_at_mut(out_pixels);
        let (acc_g, acc_b) = rest.split_at_mut(out_pixels);
        let tile_rgb = &c.batch_stage[b * 3 * tile_pixels..(b + 1) * 3 * tile_pixels];
        accumulate_tile(
            [acc_r, acc_g, acc_b],
            &mut c.weights,
            tile_rgb,
            &mut c.fx,
            tx,
            ty,
            tile_out_w as usize,
            tile_out_h as usize,
            out_w as usize,
            feather,
        );
    }
    // Pack: w = weights[i] || 1, clamp + round-half-up via +0.5/trunc (see
    // compose_single_exec: no round() libcall, vectorizes).
    for i in 0..out_pixels {
        let w = if c.weights[i] == 0.0 {
            1.0
        } else {
            c.weights[i]
        };
        let r = (c.acc[i] / w).max(0.0).min(1.0) * 255.0 + 0.5;
        let g = (c.acc[out_pixels + i] / w).max(0.0).min(1.0) * 255.0 + 0.5;
        let bl = (c.acc[2 * out_pixels + i] / w).max(0.0).min(1.0) * 255.0 + 0.5;
        c.rgba[4 * i] = r as u8;
        c.rgba[4 * i + 1] = g as u8;
        c.rgba[4 * i + 2] = bl as u8;
        c.rgba[4 * i + 3] = 255;
    }
}

/// Byte offset of the packed RGBA8 staging (length = compose_output_len).
#[no_mangle]
pub extern "C" fn compose_output_ptr() -> u32 {
    composer().rgba.as_ptr() as u32
}

/// Packed RGBA8 length in bytes.
#[no_mangle]
pub extern "C" fn compose_output_len() -> u32 {
    composer().rgba.len() as u32
}

/// Single-tile fast lane: no overlap exists, so the weighted average is
/// algebraically the input itself — convert + pack directly, no
/// accumulator, no weights, no divisions. Single coverage makes the feather
/// ramp cancel out ((x*w)/w == x up to float rounding), so this is the
/// MORE accurate form; the gate is PSNR vs the full lane (>= 100 dB).
/// Operates on the kind-0 staging (caller staged the planar 4x frame first).
///
/// Precision trap (measured, not theorized): JS widens Float32Array reads
/// to f64, so `plan[i] * 255` is an EXACT f64 product there; in f32 the
/// same product can round UP across a .5 boundary (0.9 x 255 = 229.49999…
/// in f64 but 229.5 in f32) and flip the rounding. Computing in f64 here
/// reproduces the JS bits exactly (f64 mul is exact for f32×255, both IEEE
/// deterministic) — the lane is bit-identical, not just PSNR-gated.
///
/// Rounding without a libcall: `.round()` compiles to a `roundf` call on
/// wasm32 (tens of millions of calls per frame); `+ 0.5` + truncating `as`
/// cast is round-half-up on our clamped non-negative domain, branchless,
/// and vectorizes. Same for the multi pack loop below.
#[no_mangle]
pub extern "C" fn compose_single_exec(pixels: u32) {
    let c = composer();
    let out_pixels = pixels as usize;
    assert!(c.batch_stage.len() >= 3 * out_pixels);
    c.rgba.resize(4 * out_pixels, 0);
    let (r_plane, rest) = c.batch_stage.split_at(out_pixels);
    let (g_plane, b_plane) = rest.split_at(out_pixels);
    for (i, out) in c.rgba.chunks_exact_mut(4).enumerate() {
        out[0] = (r_plane[i].max(0.0).min(1.0) as f64 * 255.0 + 0.5) as u8;
        out[1] = (g_plane[i].max(0.0).min(1.0) as f64 * 255.0 + 0.5) as u8;
        out[2] = (b_plane[i].max(0.0).min(1.0) as f64 * 255.0 + 0.5) as u8;
        out[3] = 255;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lcg(seed: u64) -> impl FnMut() -> f32 {
        let mut state = seed;
        move || {
            state = state
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((state >> 33) as f32) / (u32::MAX as f32) * 2.0 - 0.25
        }
    }

    /// Independent scalar reference (subscript math, no iterators): guards
    /// the shared formula against a systematic iterator-shape mistake.
    fn scalar_compose(
        batch: &[f32],
        tiles_xy: &[(u32, u32)],
        tile_out_w: usize,
        tile_out_h: usize,
        out_w: usize,
        out_h: usize,
        feather: u32,
    ) -> Vec<u8> {
        let out_pixels = out_w * out_h;
        let mut acc = vec![0.0f32; 3 * out_pixels];
        let mut weights = vec![0.0f32; out_pixels];
        let tile_pixels = tile_out_w * tile_out_h;
        let ramp =
            |i: usize, len: usize| -> f32 { (i.min(len - 1 - i) + 1).min(feather as usize) as f32 };
        for (b, &(tx, ty)) in tiles_xy.iter().enumerate() {
            for row in 0..tile_out_h {
                let wy = ramp(row, tile_out_h);
                for col in 0..tile_out_w {
                    let w = ramp(col, tile_out_w).min(wy);
                    let src = row * tile_out_w + col;
                    let out = (ty as usize + row) * out_w + tx as usize + col;
                    for ch in 0..3 {
                        acc[ch * out_pixels + out] +=
                            batch[b * 3 * tile_pixels + ch * tile_pixels + src] * w;
                    }
                    weights[out] += w;
                }
            }
        }
        pack_rgba(&acc, &weights, out_pixels)
    }

    fn pack_rgba(acc: &[f32], weights: &[f32], out_pixels: usize) -> Vec<u8> {
        let mut rgba = vec![0u8; 4 * out_pixels];
        for i in 0..out_pixels {
            let w = if weights[i] == 0.0 { 1.0 } else { weights[i] };
            rgba[4 * i] = ((acc[i] / w).max(0.0).min(1.0) * 255.0).round() as u8;
            rgba[4 * i + 1] = ((acc[out_pixels + i] / w).max(0.0).min(1.0) * 255.0).round() as u8;
            rgba[4 * i + 2] =
                ((acc[2 * out_pixels + i] / w).max(0.0).min(1.0) * 255.0).round() as u8;
            rgba[4 * i + 3] = 255;
        }
        rgba
    }

    /// Drive the production accumulate_tile (borrowed slices) over local
    /// buffers and pack with the shared packer.
    fn production_compose(
        batch: &[f32],
        tiles_xy: &[(u32, u32)],
        tile_out_w: usize,
        tile_out_h: usize,
        out_w: usize,
        out_h: usize,
        feather: u32,
    ) -> Vec<u8> {
        let out_pixels = out_w * out_h;
        let tile_pixels = tile_out_w * tile_out_h;
        let mut acc = vec![0.0f32; 3 * out_pixels];
        let mut weights = vec![0.0f32; out_pixels];
        let mut fx = vec![0.0f32; tile_out_w.max(1)];
        for (b, &(tx, ty)) in tiles_xy.iter().enumerate() {
            let (acc_r, rest) = acc.split_at_mut(out_pixels);
            let (acc_g, acc_b) = rest.split_at_mut(out_pixels);
            let tile_rgb = &batch[b * 3 * tile_pixels..(b + 1) * 3 * tile_pixels];
            accumulate_tile(
                [acc_r, acc_g, acc_b],
                &mut weights,
                tile_rgb,
                &mut fx,
                tx as usize,
                ty as usize,
                tile_out_w,
                tile_out_h,
                out_w,
                feather,
            );
        }
        pack_rgba(&acc, &weights, out_pixels)
    }

    #[test]
    fn production_matches_scalar_exactly() {
        // 2 overlapping tiles over a 12x8 output, procedural data incl.
        // negatives and over-ones (clamp path). Bit-exact on x86-64 (no FMA
        // contraction without +fma): validates lane/iterator logic.
        let tile_out_w = 8usize;
        let tile_out_h = 8usize;
        let out_w = 12usize;
        let out_h = 8usize;
        let tiles = [(0u32, 0u32), (4, 0)];
        let tile_pixels = tile_out_w * tile_out_h;
        let mut gen = lcg(1234);
        let batch: Vec<f32> = (0..2 * 3 * tile_pixels).map(|_| gen()).collect();
        let reference = scalar_compose(&batch, &tiles, tile_out_w, tile_out_h, out_w, out_h, 48);
        assert_eq!(
            production_compose(&batch, &tiles, tile_out_w, tile_out_h, out_w, out_h, 48),
            reference
        );
    }

    #[test]
    fn single_pixel_tile_packs() {
        let batch = vec![0.5f32, 0.25, 1.0];
        let reference = scalar_compose(&batch, &[(0, 0)], 1, 1, 1, 1, 48);
        // weight = min(min(0,0)+1,48) = 1; out = in.
        assert_eq!(reference, vec![128, 64, 255, 255]);
    }
}
