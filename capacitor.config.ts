import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.funtok.app",
  appName: "Funtok",
  webDir: "dist/client",
  backgroundColor: "#000000",
  plugins: {
    AdMob: {
      appId: "ca-app-pub-3877753844959715~4589245523",
    },
  },
};

export default config;
