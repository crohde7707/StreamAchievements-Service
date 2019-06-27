const path = require('path');
const nodeExternals = require('webpack-node-externals');
const TerserPlugin = require('terser-webpack-plugin');

const serverConfig = {
  target: "node",
  entry: {
    app: ["./server/main.js"]
  },
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "server.js"
  },
  optimization: {
  	minimizer: [
  		new TerserPlugin(/*{
  			output: {
  				comments: false
  			}
  		}*/)
  	]
  },
  externals: [nodeExternals()],
};

module.exports = serverConfig;