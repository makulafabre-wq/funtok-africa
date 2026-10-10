export const BUNNY_LIBRARY_ID = "775931";
export const BUNNY_CDN = "https://vz-e91c29a7-705.b-cdn.net";

export const playlistUrl = (videoId: string) => `${BUNNY_CDN}/${videoId}/playlist.m3u8`;
export const thumbUrl = (videoId: string, width = 300) =>
  `${BUNNY_CDN}/${videoId}/thumbnail.jpg?width=${width}`;

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export function extractTags(caption: string) {
  const hashtags = Array.from(new Set((caption.match(/#[\p{L}\d_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase())));
  const mentions = Array.from(new Set((caption.match(/@[\w.]+/g) ?? []).map((t) => t.slice(1).toLowerCase())));
  return { hashtags, mentions };
}
