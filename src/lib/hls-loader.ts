let loading: Promise<typeof import("hls.js")> | undefined;

/** Share one browser-only import across all feed players. */
export function loadHls() {
  loading ??= import("hls.js").catch((error: unknown) => { loading = undefined; throw error; });
  return loading;
}