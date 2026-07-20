# Vendored ArtCNN shader

`glsl/ArtCNN_C4F16.glsl` is an unmodified copy of the official MIT-licensed
fragment shader pinned in `SOURCE_REVISION.json`. The build translates its mpv
passes to WGSL and Direct3D 11 compute shaders; runtime downloads are not used.
