module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: {
            "@": "./",
            "@lib": "./lib",
          },
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      ],

      // IMPORTANT : reanimated en dernier
      "react-native-reanimated/plugin",
    ],
  };
};
