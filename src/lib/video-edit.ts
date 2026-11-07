export const VIDEO_FILTERS = [
  { name: "Original", css: "none" },
  { name: "Warm", css: "sepia(0.3) saturate(1.3)" },
  { name: "Cool", css: "hue-rotate(-15deg) saturate(1.2)" },
  { name: "B&W", css: "grayscale(1)" },
  { name: "Vivid", css: "saturate(1.8) contrast(1.1)" },
];

export function videoFilter(base: string, beauty: boolean, effect: boolean) {
  return [base === "none" ? "" : base, beauty ? "brightness(1.08) contrast(0.95) saturate(1.1)" : "", effect ? "hue-rotate(40deg) saturate(1.6)" : ""].filter(Boolean).join(" ") || "none";
}

/** Browser-only, real-time export: edits and music are baked into the uploaded file. */
export async function exportVideo(file: File, options: { filter: string; speed: number; music: File | null; originalVolume: number; musicVolume: number; signal: AbortSignal; onProgress: (value: number) => void }): Promise<File> {
  if (options.filter === "none" && options.speed === 1 && !options.music && options.originalVolume === 1) return file;
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) throw new Error("This browser cannot save video edits. Use Chrome or choose the original video.");
  const video = document.createElement("video");
  video.playsInline = true;
  video.preload = "auto";
  const url = URL.createObjectURL(file);
  video.src = url;
  let audioUrl: string | undefined;
  let music: HTMLAudioElement | undefined;
  let context: AudioContext | undefined;
  let output: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let frame = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("This video could not be opened. Choose another file."));
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("Video duration is unavailable. Choose another video.");
    if (options.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    video.playbackRate = options.speed;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx || !("filter" in ctx)) throw new Error("Video filters are unsupported in this browser.");
    context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    const original = context.createMediaElementSource(video);
    const originalGain = context.createGain();
    originalGain.gain.value = options.originalVolume;
    original.connect(originalGain).connect(destination);
    if (options.music) {
      audioUrl = URL.createObjectURL(options.music);
      music = new Audio(audioUrl);
      music.loop = true;
      const source = context.createMediaElementSource(music);
      const gain = context.createGain();
      gain.gain.value = options.musicVolume;
      source.connect(gain).connect(destination);
    }
    output = canvas.captureStream(30);
    destination.stream.getAudioTracks().forEach((track) => output?.addTrack(track));
    const mimeType = ["video/webm;codecs=vp8,opus", "video/mp4", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(output, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const draw = () => {
      ctx.filter = options.filter;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      options.onProgress(Math.min(99, Math.round(video.currentTime / video.duration * 100)));
      frame = requestAnimationFrame(draw);
    };
    await context.resume();
    const complete = new Promise<void>((resolve, reject) => {
      if (!recorder) return reject(new Error("Could not prepare video."));
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("Could not save your video edits."));
      video.onended = () => { if (recorder?.state === "recording") recorder.stop(); };
      options.signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    });
    recorder.start(1000);
    draw();
    await video.play();
    if (music) await music.play();
    await complete;
    const type = recorder.mimeType || "video/webm";
    const blob = new Blob(chunks, { type });
    if (!blob.size) throw new Error("No edited video was produced. Please try again.");
    options.onProgress(100);
    return new File([blob], `funtok-edited.${type.includes("mp4") ? "mp4" : "webm"}`, { type });
  } finally {
    cancelAnimationFrame(frame);
    video.pause();
    music?.pause();
    if (recorder?.state === "recording") recorder.stop();
    output?.getTracks().forEach((track) => track.stop());
    if (context) await context.close();
    URL.revokeObjectURL(url);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }
}