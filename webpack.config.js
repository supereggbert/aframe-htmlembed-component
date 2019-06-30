const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: './index.js',

	output: {
		filename: 'build.js',
		path: path.resolve(__dirname, 'dist')
	},

	plugins: [new webpack.ProgressPlugin(), new CopyPlugin([
      { from: 'examples', to: 'examples' }
  ])],

	module: {
		rules: [
			{
				test: /.(js|jsx)$/,
				include: [],
				loader: 'babel-loader',

				options: {
					plugins: ['syntax-dynamic-import'],

					presets: [
						[
							'@babel/preset-env',
							{
								modules: false
							}
						]
					]
				}
			}
		]
	},

	devServer: {
		open: true
	}
};
