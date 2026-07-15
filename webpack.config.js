const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const WebExtensionPlugin = require('webpack-target-webextension');
const { Compilation, DefinePlugin, sources } = require('webpack');

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
  const accountApiUrl = process.env.ANIME4K_ACCOUNT_API_URL || 'http://localhost:4242';
  const neonAuthUrl = process.env.ANIME4K_NEON_AUTH_URL
    || 'https://ep-orange-lake-ajqnw0vw.neonauth.c-3.us-east-2.aws.neon.tech/neondb/auth';

  const manifest = require('./manifest.json');
  const browserOnnxAssets = targetBrowser === 'firefox' ? [] : [
    {
      from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
      to: 'ort/ort-wasm-simd-threaded.asyncify.mjs',
    },
    {
      from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
      to: 'ort/ort-wasm-simd-threaded.asyncify.wasm',
    },
  ];

  // Apply the browser-specific manifest shape.
  if (targetBrowser === 'firefox') {
    delete manifest.key;
    // Firefox MV3 still uses a background script rather than service_worker.
    delete manifest.background.service_worker;
    manifest.background.scripts = ['background.js'];
    manifest.browser_specific_settings = {
      gecko: {
        id: 'anime4k-webextension@chenmozhijin',
        data_collection_permissions: {
          required: ['none']
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
      alias: {
        'anime4k-webgpu$': path.resolve(__dirname, '.generated/anime4k-webgpu/index.js'),
      },
      conditionNames: ['onnxruntime-web-use-extern-wasm', 'webpack', 'browser', 'import', 'default'],
    },
    plugins: [
      new DefinePlugin({
        __ANIME4K_E2E__: JSON.stringify(isE2EBuild),
        __ANIME4K_BROWSER_ONNX__: JSON.stringify(targetBrowser !== 'firefox'),
        __ANIME4K_ACCOUNT_API_URL__: JSON.stringify(accountApiUrl.replace(/\/$/, '')),
        __ANIME4K_NEON_AUTH_URL__: JSON.stringify(neonAuthUrl.replace(/\/$/, '')),
      }),
      new CleanWebpackPlugin(),
      new CopyWebpackPlugin({
        patterns: [
          { from: '*.png', context: 'public/icons', to: 'icons' },
          { from: 'public/_locales/en', to: '_locales/en' },
          {
            from: 'public/models',
            to: 'models',
            ...(targetBrowser === 'firefox' ? { globOptions: { ignore: ['**/*.onnx'] } } : {}),
          },
          ...browserOnnxAssets,
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
    watch: isDevelopment,
  };
};
