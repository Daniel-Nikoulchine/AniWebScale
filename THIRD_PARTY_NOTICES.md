# Third-party notices

This project includes and modifies software and generated shader data from:

- [Anime4K](https://github.com/bloc97/Anime4K), Copyright (c) 2019 bloc97.
- [Anime4K-WebGPU](https://github.com/Anime4KWebBoost/Anime4K-WebGPU), Copyright (c) 2012-2023 Scott Chacon and others.
- [ONNX Runtime](https://github.com/microsoft/onnxruntime), Copyright (c) Microsoft Corporation.
- [Anime4K-WebExtension](https://github.com/chenmozhijin/Anime4K-WebExtension), Copyright (c) 2025 沉默の金.
- [ArtCNN](https://github.com/Artoriuz/ArtCNN), Copyright (c) 2021 Artoriuz.
- [ACNetGLSL](https://github.com/TianZerL/ACNetGLSL), Copyright (c) 2021 TianZerL.

Each project is distributed under the MIT License:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

The generated WGSL kernels in `src/shared/generated-kernels.ts` retain the
Anime4K model descriptions and weights and are covered by the Anime4K notice
above. `src/shared/generated-external-glsl-models.ts` retains the pinned ArtCNN
C4F16, ACNet F8B4, and ARNet F8B8 weights and is covered by the corresponding
ArtCNN and ACNetGLSL notices above. Complete license copies ship as
`models/ArtCNN.LICENSE.txt` and `models/ACNetGLSL.LICENSE.txt`. Magpie code and
binaries are not included.

The `AnimeJaNai-HD-V3.1-Performance-x2.onnx` model originates from
[mpv-AnimeJaNai](https://github.com/the-database/mpv-AnimeJaNai). It is bundled
under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0). It may not be used for commercial purposes, attribution is
required, and adaptations must be shared under the same license. The complete
license is shipped beside the model as `models/AnimeJaNai.LICENSE.txt`. The
packaged graph adds Float32 input/output casts for browser ONNX Runtime
compatibility while retaining the original FP16 network and weights.

The native package also includes the upstream `aji` DirectML inference bridge
from [animejanai-inference](https://github.com/the-database/animejanai-inference),
ONNX Runtime DirectML 1.24.4, and Microsoft DirectML 1.15.4. Their complete
notices are shipped under `models/animejanai/licenses/`. The `aji` binary and
model remain subject to the AnimeJaNai CC BY-NC-SA 4.0 terms above; ONNX Runtime
and DirectML are MIT licensed.

## Lucide theme icons

The settings header uses the Sun and Moon icons from
[Lucide Static](https://lucide.dev/), version 1.24.0.

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

The Moon icon is derived from the Feather project and is additionally covered
by the MIT License:

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
