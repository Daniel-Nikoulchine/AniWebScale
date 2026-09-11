const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const WebExtensionPlugin = require('webpack-target-webextension');
const { Compilation, DefinePlugin, sources } = require('webpack');
const { toWebpackAliases } = require('./scripts/webpack-aliases.cjs');

class RemoveUnsafeGlobalFallbackPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('RemoveUnsafeGlobalFallbackPlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'RemoveUnsafeGlobalFallbackPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        },
        assets => {
          for (const [filename, asset] of Object.entries(assets)) {
            if (!filename.endsWith('.js')) continue;
            const original = asset.source().toString();
            const patched = original.replace(
              /new Function\(\s*(['"])return this\1\s*\)\(\)/g,
              'globalThis',
            );
            if (patched !== original) {
              compilation.updateAsset(filename, new sources.RawSource(patched));
            }
          }
        },
      );
    });
  }
}

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';
  const targetBrowser = process.env.TARGET_BROWSER || 'chrome';
  const isE2EBuild = process.env.ANIME4K_E2E === '1';

  const manifest = structuredClone(require('./manifest.json'));
  const extensionIdentities = require('./native/extension-identities.json');

  // Browser E2E runs cannot interact with the permission prompt. Keep the
  // production manifest granular while giving the test-only build deterministic
  // content-script injection.
  if (isE2EBuild) {
    delete manifest.optional_host_permissions;
    manifest.host_permissions = ['http://*/*', 'https://*/*'];
    manifest.content_scripts = [
      {
        matches: ['http://*/*', 'https://*/*'],
        js: ['fullscreen-bridge.js'],
        run_at: 'document_start',
        all_frames: true,
        match_about_blank: true,
        match_origin_as_fallback: true,
        world: 'MAIN',
      },
      {
        matches: ['http://*/*', 'https://*/*'],
        js: ['content.js'],
        run_at: 'document_idle',
        all_frames: true,
        match_about_blank: true,
        match_origin_as_fallback: true,
      },
    ];
  }

  // Apply the browser-specific manifest shape.
  if (targetBrowser === 'firefox') {
    delete manifest.key;
    // Firefox MV3 still uses a background script rather than service_worker.
    delete manifest.background.service_worker;
    manifest.background.scripts = ['background.js'];
    manifest.browser_specific_settings = {
      gecko: {
        id: extensionIdentities.firefoxExtensionId,
        data_collection_permissions: {
          required: ['authenticationInfo', 'personallyIdentifyingInfo']
        }
      },
    };
  }


  return {
    entry: {
      'fullscreen-bridge': './src/page/fullscreen-bridge.ts',
      popup: './src/ui/popup/popup.ts',
      options: './src/ui/options/options.ts',
      onboarding: './src/ui/onboarding/onboarding.ts',
      grant: './src/ui/grant/grant.ts',
      content: './src/content.ts',
      background: './src/background.ts'
    },
    output: {
      filename: '[name].js',
      chunkFilename: 'chunks/[name].js',
      path: path.resolve(__dirname, 'dist-' + targetBrowser),
      globalObject: 'globalThis',
      environment: { globalThis: true },
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: toWebpackAliases(),
    },
    plugins: [
      new DefinePlugin({
        __ANIME4K_E2E__: JSON.stringify(isE2EBuild),
      }),
      new CleanWebpackPlugin(),
      new CopyWebpackPlugin({
        patterns: [
          { from: '*.png', context: 'public/icons', to: 'icons' },
          { from: 'public/_locales', to: '_locales' },
          // onnxruntime-web runtime for the RealESRGAN/RealCUGAN ONNX inference
          // paths. The session factory points env.wasm.wasmPaths and the worker
          // bundle import at these extension-relative URLs.
          //
          // ort.webgpu.bundle.min.mjs is the standalone WebGPU-enabled bundle
          // (matches the `ort/ort.webgpu.min.mjs` path the worker hands to the
          // blob-URL import).
          {
            from: 'node_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs',
            to: 'ort/ort.webgpu.min.mjs',
          },
          // The .mjs + .wasm pair for the jsep (WebGPU + multi-thread) WASM
          // module. onnxruntime-web dynamically imports the .mjs wrapper to
          // initialise the WebGPU execution provider; copying only the .wasm
          // (as we did previously) makes that import fail with
          // "error loading dynamically imported module: ...jsep.mjs".
          {
            from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
            to: 'ort/ort-wasm-simd-threaded.jsep.mjs',
          },
          {
            from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
            to: 'ort/ort-wasm-simd-threaded.jsep.wasm',
          },
          // Single-threaded WASM fallback (no WebGPU, no SharedArrayBuffer).
          {
            from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
            to: 'ort/ort-wasm-simd-threaded.wasm',
          },
          {
            from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
            to: 'ort/ort-wasm-simd-threaded.mjs',
          },
          // The asyncify build is what onnxruntime-web actually uses in the
          // browser by default (the WebGPU .bundle + asyncify WASM are the
          // pair the runtime is wired against in 1.29+).
          {
            from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
            to: 'ort/ort-wasm-simd-threaded.asyncify.wasm',
          },
          {
            from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
            to: 'ort/ort-wasm-simd-threaded.asyncify.mjs',
          },
          // The RealESRGAN inference worker is loaded at runtime as an
          // unbundled plain-JS module (fetched, wrapped in a Blob URL, started
          // as a module worker), so it must ship verbatim. Missing this copy
          // made the client's fetch 404 and silently disabled the whole
          // worker path (every frame fell back to the main-thread session).
          { from: 'src/worker/*.js', to: 'chunks/[name][ext]' },
          // Hebel E5: the WASM-SIMD compose module the worker fetches at
          // runtime. Optional like the FP16 models: absence only costs the
          // SIMD speedup (JS compose fallback), never a frame. Built by
          // npm run generate:pixels-wasm (cargo-less checkouts keep a stale
          // copy or ship without).
          { from: 'wasm/pixels.wasm', to: 'chunks/pixels.wasm', noErrorOnMissing: true },
          { from: 'models', to: 'models', globOptions: { ignore: ['**/*.fp16.onnx'] } },
          // Optional FP16 models are copied only when present in the source
          // tree; the runtime probes the asset and falls back to FP32.
          { from: 'models/realesrgan/*.fp16.onnx', to: 'models/realesrgan/[name][ext]', noErrorOnMissing: true },
        ],
      }),
      new HtmlWebpackPlugin({
        filename: 'popup.html',
        template: './src/ui/popup/popup.html',
        chunks: ['popup'],
      }),
      new HtmlWebpackPlugin({
        filename: 'options.html',
        template: './src/ui/options/options.html',
        chunks: ['options'],
      }),
      new HtmlWebpackPlugin({
        filename: 'onboarding.html',
        template: './src/ui/onboarding/onboarding.html',
        chunks: ['onboarding'],
      }),
      new HtmlWebpackPlugin({
        filename: 'grant.html',
        template: './src/ui/grant/grant.html',
        chunks: ['grant'],
      }),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new ExtensionManifestPlugin({
        config: {
          base: manifest,
        },
        pkgJsonProps: [
          'version'
        ]
      }),
      new WebExtensionPlugin({
        background: {
          classicLoader: false,
        },
        weakRuntimeCheck: true,
      }),
      new RemoveUnsafeGlobalFallbackPlugin(),
    ].filter(Boolean),
    devtool: isDevelopment ? 'inline-source-map' : false,
    performance: {
      maxAssetSize: 750 * 1024,
      maxEntrypointSize: 750 * 1024,
    },
    watch: isDevelopment,
  };
};
