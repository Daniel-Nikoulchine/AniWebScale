# Vendored Anime4K model shaders

This directory contains an exact, source-level subset of the official
[bloc97/Anime4K](https://github.com/bloc97/Anime4K) repository at commit
`7684e9586f8dcc738af08a1cdceb024cc184f426`.

The subset contains the highlight clamp plus the M, VL, and UL variants of:

- Restore CNN
- Restore CNN Soft
- Upscale CNN x2
- Upscale + Denoise CNN x2

The files remain under the upstream MIT license. `LICENSE` is copied from the
same revision. Do not edit the GLSL files locally: update the pinned revision,
copy the new upstream sources, and regenerate `native/generated-models` with
`native/tools/generate_anime4k_models.py`.
