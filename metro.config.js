const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withMonicon } = require("@monicon/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
const projectEntryPoint = path.join(__dirname, "package.json");
const nativeWindCache = path.join(
  __dirname,
  "node_modules",
  "react-native-css-interop",
  ".cache",
);

// Windows puede agotar los manejadores de archivos durante reconstrucciones
// grandes. Reducir la concurrencia mantiene estable la caché de Metro.
config.maxWorkers = 2;
config.watchFolders = [...(config.watchFolders || []), nativeWindCache];

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
  // Loading entire Iconify collections exhausts Windows file handles while
  // Metro is also crawling the project. Keep this list scoped to icons used
  // by the application.
  icons: [
    "ci:arrow-down-up",
    "ci:building-03",
    "ci:calendar-event",
    "ci:chart-pie",
    "ci:chevron-down",
    "ci:chevron-left",
    "ci:chevron-right",
    "ci:chevron-up",
    "ci:file-document",
    "ci:list-checklist",
    "ci:map",
    "ci:note-edit",
    "ci:search-magnifying-glass",
    "ci:users-group",
    "ic:baseline-arrow-back-ios-new",
    "ic:outline-business",
    "ic:outline-dark-mode",
    "ic:outline-event",
    "ic:outline-home",
    "ic:outline-investment",
    "ic:outline-light-mode",
    "ic:outline-logout",
    "ic:outline-settings",
    "ic:outline-tour",
    "material-symbols:account-circle-outline",
    "material-symbols:article-outline",
    "material-symbols:chevron-right",
    "material-symbols:delete-outline",
    "material-symbols:description-outline",
    "material-symbols:edit-outline",
    "material-symbols:home-outline-rounded",
    "material-symbols:list-alt-check-outline",
    "material-symbols:lock-outline",
    "material-symbols:privacy-tip-outline",
    "material-symbols:settings-outline-rounded",
    "material-symbols:shield-lock-outline",
    "mdi:account",
    "mdi:account-edit",
    "mdi:account-group",
    "mdi:calendar-multiple",
    "mdi:calendar-star",
    "mdi:camera",
    "mdi:camera-flip",
    "mdi:card-account-details",
    "mdi:cash-remove",
    "mdi:chart-line",
    "mdi:check-circle",
    "mdi:check-circle-outline",
    "mdi:chef-hat",
    "mdi:clipboard-check",
    "mdi:clipboard-text",
    "mdi:close",
    "mdi:eye",
    "mdi:eye-off",
    "mdi:factory",
    "mdi:file-document-edit",
    "mdi:form",
    "mdi:information-outline",
    "mdi:loading",
    "mdi:map-marker",
    "mdi:map-marker-star",
    "mdi:store",
    "mdi:store-outline",
    "mdi:table",
    "mdi:trending-up",
  ],
});

const configWithNativeWind = withNativeWind(configWithMonicon, {
  input: "./global.css",
  inlineRem: 16,
  // NativeWind 4 emits the legacy `eventsQueue` Haste payload during fast
  // refresh, while the Metro version bundled with Expo 57 expects `changes`.
  // Writing the generated module lets Metro's watcher create the right event.
  forceWriteFileSystem: true,
});

module.exports = configWithNativeWind;
