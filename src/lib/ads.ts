/**
 * AdMob runs only inside the installed Android/iOS app. On the web we fall back to
 * Funtok's own ads from the database so placements still show something.
 */
export const ADMOB = {
  appId: (import.meta.env["VITE_ADMOB_APP_ID"] as string) || "ca-app-pub-3877753844959715~4589245523",
  banner: (import.meta.env["VITE_ADMOB_BANNER_ID"] as string) || "ca-app-pub-3877753844959715/5252513944",
  native: (import.meta.env["VITE_ADMOB_NATIVE_ID"] as string) || "ca-app-pub-3877753844959715/7084470360",
  // No interstitial/rewarded units were provided yet: these are Google's official test units.
  interstitial: (import.meta.env["VITE_ADMOB_INTERSTITIAL_ID"] as string) || "ca-app-pub-3940256099942544/1033173712",
  rewarded: (import.meta.env["VITE_ADMOB_REWARDED_ID"] as string) || "ca-app-pub-3940256099942544/5224354917",
  // Keep test ads until the new units are live, then set VITE_ADMOB_LIVE=true.
  testing: import.meta.env["VITE_ADMOB_LIVE"] !== "true",
};

export const INTERSTITIAL_EVERY = 10;

async function native() {
  if (typeof window === "undefined") return null;
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;
  return import("@capacitor-community/admob");
}

let initialized = false;
export async function initAds() {
  const m = await native();
  if (!m || initialized) return;
  initialized = true;
  await m.AdMob.initialize({ initializeForTesting: ADMOB.testing });
}

export async function isNativeAds() { return (await native()) !== null; }

export async function showNativeBanner(margin = 64) {
  const m = await native();
  if (!m) return false;
  await m.AdMob.showBanner({
    adId: ADMOB.banner, adSize: m.BannerAdSize.ADAPTIVE_BANNER,
    position: m.BannerAdPosition.BOTTOM_CENTER, margin, isTesting: ADMOB.testing,
  });
  return true;
}
export async function hideNativeBanner() { const m = await native(); if (m) await m.AdMob.removeBanner().catch(() => {}); }

export async function showNativeInterstitial() {
  const m = await native();
  if (!m) return false;
  await m.AdMob.prepareInterstitial({ adId: ADMOB.interstitial, isTesting: ADMOB.testing });
  await m.AdMob.showInterstitial();
  return true;
}

/** Resolves true when the user earned the reward. Returns null on web (caller shows house ad). */
export async function showNativeRewarded(): Promise<boolean | null> {
  const m = await native();
  if (!m) return null;
  await m.AdMob.prepareRewardVideoAd({ adId: ADMOB.rewarded, isTesting: ADMOB.testing });
  const reward = await m.AdMob.showRewardVideoAd();
  return !!reward;
}
