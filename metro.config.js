const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/src/defaults/exclusionList");

const config = getDefaultConfig(__dirname);

// 🔥 Bloque ESLint files
config.resolver.blockList = exclusionList([
  /eslint\.config\.(js|cjs|mjs)$/,
]);

// 🔥 🔥 🔥 BLOCK STRIPE ON WEB
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    moduleName === "@stripe/stripe-react-native"
  ) {
    return {
      type: "sourceFile",
      filePath: require.resolve("./empty.js"),
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;