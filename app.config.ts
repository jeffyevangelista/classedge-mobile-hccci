import type { ConfigContext, ExpoConfig } from "expo/config";

type Variant = "development" | "preview" | "production";

const VARIANT: Variant =
  (process.env.APP_VARIANT as Variant | undefined) ??
  (process.env.EAS_BUILD_PROFILE as Variant | undefined) ??
  "development";

const variantConfig = {
  development: {
    name: "Classedge Dev",
    bundleIdentifier: "com.classify.classedge.dev",
    androidPackage: "com.classify.classedge.dev",
    scheme: "classedge.dev",
    onesignalMode: "development" as const,
    apsEnvironment: "development" as const,
  },
  preview: {
    name: "Classedge Preview",
    bundleIdentifier: "com.classify.classedge.preview",
    androidPackage: "com.classify.classedge.preview",
    scheme: "classedge.preview",
    onesignalMode: "production" as const,
    apsEnvironment: "production" as const,
  },
  production: {
    name: "Classedge",
    bundleIdentifier: "com.classify.classedge",
    androidPackage: "com.classify.classedge",
    scheme: "classedge",
    onesignalMode: "production" as const,
    apsEnvironment: "production" as const,
  },
}[VARIANT];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variantConfig.name,
  slug: "classedge",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: variantConfig.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: variantConfig.bundleIdentifier,
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
      ITSAppUsesNonExemptEncryption: false,
    },
    entitlements: {
      "aps-environment": variantConfig.apsEnvironment,
    },
    icon: {
      dark: "./assets/icons/ios/ios-dark.png",
      light: "./assets/icons/ios/ios-light.png",
      tinted: "./assets/icons/ios/ios-tinted.png",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/icons/android/adaptive-icon.png",
      backgroundColor: "#fff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: variantConfig.androidPackage,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
    ],
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    [
      "onesignal-expo-plugin",
      {
        mode: variantConfig.onesignalMode,
        smallIcons: ["./assets/notifications/ic_stat_onesignal_default.png"],
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "Allow Classedge to access your camera",
        microphonePermission: "Allow Classedge to access your microphone",
        barcodeScannerEnabled: true,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow Classedge to access your photos so you can change your profile photo.",
        cameraPermission:
          "Allow Classedge to use your camera so you can take a new profile photo.",
      },
    ],
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/icons/splash/splash-icon-light.png",
        imageWidth: 120,
        imageHeight: 120,
        resizeMode: "contain",
        backgroundColor: "#f9f9f9",
        dark: {
          image: "./assets/icons/splash/splash-icon-dark.png",
          backgroundColor: "#0b1220",
        },
      },
    ],
    "expo-web-browser",
    "expo-background-task",
    "expo-video",
    "@react-native-community/datetimepicker",
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io",
        organization: "dev-phase",
        project: "react-native",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appVariant: VARIANT,
    onesignalAppId: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,
    eas: {
      build: {
        experimental: {
          ios: {
            appExtensions: [
              {
                targetName: "OneSignalNotificationServiceExtension",
                bundleIdentifier: `${variantConfig.bundleIdentifier}.OneSignalNotificationServiceExtension`,
                entitlements: {
                  "com.apple.security.application-groups": [
                    `group.${variantConfig.bundleIdentifier}.onesignal`,
                  ],
                },
              },
            ],
          },
        },
      },
      projectId: "f1f67952-1a82-470a-a9d0-a723f9a96f39",
    },
    router: {},
  },
});
