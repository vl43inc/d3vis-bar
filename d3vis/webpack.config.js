let path = require('path');
const TerserJSPlugin = require('terser-webpack-plugin');

let webpackConfig = {
    entry: {
        bargraph: './src/visualizations/barGraph.ts'
    },
    output: {
        filename: '[name].js',
        path: path.join(__dirname, 'dist'),
        library: '[name]',
        libraryTarget: 'umd',
        clean: true
    },
    resolve: {
        extensions: ['.ts', '.js', '.scss', '.css']
    },
    plugins: [
        new TerserJSPlugin()
    ],
    module: {
        rules: [
            { test: /\.ts$/, loader: 'ts-loader' },
            { test: /\.css$/, loader: 'css-loader' },
            { test: /\.scss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader',
                ]
            }
        ]
    },
    mode: 'development',
    devServer: {
				static: {directory: path.resolve(__dirname, 'dist')},
        compress: true,
        server: 'https',
        port: 3443,
				open: true,
				hot: true
    },
    devtool: 'eval'
};

module.exports = webpackConfig;