const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Enable JSON imports for IDL files
config.resolver.sourceExts = [...config.resolver.sourceExts, 'json']

// Polyfill Node.js built-in modules for Anchor compatibility
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  assert: require.resolve('assert'),
}

module.exports = config
