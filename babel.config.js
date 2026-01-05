module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel', // 👉 important pour expo-router
      ['module-resolver', {
        root: ['.'],
        alias: {
          '@': './',
          '@lib': './lib', // 👉 lib à la racine du projet
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
      }],
      'react-native-reanimated/plugin' // 👉 doit rester en dernier
    ],
  };
};
