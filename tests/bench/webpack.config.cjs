const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'webgpu-bench.ts'),
  output: {
    filename: 'bench.js',
    path: path.resolve(__dirname, '../../.tmp/anime4k-bench'),
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
