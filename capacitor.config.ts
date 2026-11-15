import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.funtok.app",
  appName: "Funtok",
  // TanStack Start outputs the static web app to .output/public, not dist/client.
  webDir: ".output/public",
  backgroundColor: "#000000",
  plugins: {
    AdMob: {
      appId: "ca-app-pub-3877753844959715~4589245523",
    },
  },
};

export default config;
