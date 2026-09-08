const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withMonicon } = require("@monicon/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
const projectEntryPoint = path.join(__dirname, "package.json");

// Windows puede agotar los manejadores de archivos durante reconstrucciones
// grandes. Reducir la concurrencia mantiene estable la caché de Metro.
config.maxWorkers = 2;

// Appwrite depends on an older expo-file-system release, whose peer dependency
// can make Bun install a second React Native. Native modules must always resolve
// against the React Native version bundled by this Expo SDK.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native" || moduleName.startsWith("react-native/")) {
    return context.resolveRequest(
      { ...context, originModulePath: projectEntryPoint },
      moduleName,
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.blockList = [/@monicon\/runtime/].concat(
  config.resolver.blockList
);

const configWithMonicon = withMonicon(config, {
  collections: [
    "radix-icons",
    "lucide",
    "fe",
    "mdi",
    "ic",
    "openmoji",
    "material-symbols",
    "ci",
  ],
});

const configWithNativeWind = withNativeWind(configWithMonicon, {
  input: "./global.css",
  inlineRem: 16,
});

module.exports = configWithNativeWind;
