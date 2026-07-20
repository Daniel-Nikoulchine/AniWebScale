const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'webgpu-entry.ts'),
  output: {
    filename: 'webgpu-golden.js',
    path: path.resolve(__dirname, '../../.tmp/shader-golden/webgpu'),
    clean: true,
  },
  module: {
    rules: [{
      test: /\.ts$/,
      use: {
        loader: 'ts-loader',
        options: { transpileOnly: true },
      },
      exclude: /node_modules/,
    }],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'anime4k-webgpu/core$': path.resolve(__dirname, '../../node_modules/anime4k-webgpu/lib/index.js'),
    },
  },
  optimization: { minimize: false },
  devtool: false,
};
