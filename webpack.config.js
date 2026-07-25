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
        'anime4k-webgpu/core$': path.resolve(__dirname, '.generated/anime4k-webgpu/core.js'),
        'anime4k-webgpu/common$': path.resolve(__dirname, '.generated/anime4k-webgpu/common.js'),
        'anime4k-webgpu/quality-m$': path.resolve(__dirname, '.generated/anime4k-webgpu/quality-m.js'),
        'anime4k-webgpu/quality-vl$': path.resolve(__dirname, '.generated/anime4k-webgpu/quality-vl.js'),
        'anime4k-webgpu/quality-ul$': path.resolve(__dirname, '.generated/anime4k-webgpu/quality-ul.js'),
        'anime4k-model/cnn-soft-ul$': path.resolve(__dirname, '.generated/anime4k-models/cnn-soft-ul.js'),
        'anime4k-model/denoise-cnn-x2-m$': path.resolve(__dirname, '.generated/anime4k-models/denoise-cnn-x2-m.js'),
        'anime4k-model/denoise-cnn-x2-ul$': path.resolve(__dirname, '.generated/anime4k-models/denoise-cnn-x2-ul.js'),
        'anime4k-model/artcnn-x2$': path.resolve(__dirname, '.generated/anime4k-models/artcnn-x2.js'),
        'anime4k-model/acnet-x2$': path.resolve(__dirname, '.generated/anime4k-models/acnet-x2.js'),
        'anime4k-model/arnet-x2$': path.resolve(__dirname, '.generated/anime4k-models/arnet-x2.js'),
      },
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
          { from: 'public/licenses', to: 'licenses' },
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
    performance: {
      maxAssetSize: 750 * 1024,
      maxEntrypointSize: 750 * 1024,
    },
    watch: isDevelopment,
  };
};
