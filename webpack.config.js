const path = require('path');
const nodeExternals = require('webpack-node-externals');

const serverConfig = {
  target: "node",
  entry: {
    app: ["./server/main.js"]
  },
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "bundle.[hash].js"
  },
  externals: [nodeExternals()],
};

module.exports = serverConfig;