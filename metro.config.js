// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Empêche Metro de charger les fichiers ESLint
config.resolver.blockList = exclusionList([
  /eslint\.config\.(js|cjs|mjs)$/,
]);

module.exports = config;
