import { BUNNY_CDN } from "./bunny";

export async function prepareVideoDownload(videoId: string): Promise<Blob> {
  const response = await fetch(`${BUNNY_CDN}/${encodeURIComponent(videoId)}/play_720p.mp4`);
  if (!response.ok) throw new Error("Video download is unavailable from Bunny right now.");
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith("video/")) throw new Error("A downloadable video isn't available yet.");
  return blob;
}

export async function deliverVideo(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (error) { if ((error as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}