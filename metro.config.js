const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Noctívago presets carry Opus clips in .ogg containers.
config.resolver.assetExts.push('ogg');

module.exports = config;
