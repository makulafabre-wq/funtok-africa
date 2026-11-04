import { useEffect, useRef, useState } from "react";
import { FlipHorizontal2, Loader2, Square, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FILTERS = [
  { name: "Original", css: "none" },
  { name: "Warm", css: "sepia(0.3) saturate(1.3)" },
  { name: "Cool", css: "hue-rotate(-15deg) saturate(1.2)" },
  { name: "B&W", css: "grayscale(1)" },
  { name: "Vivid", css: "saturate(1.8) contrast(1.1)" },
];

export function CameraRecorder({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const output = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const frame = useRef(0);
  const active = useRef(true);
  const filterRef = useRef("none");
  const [filter, setFilter] = useState("none");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      cancelAnimationFrame(frame.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      output.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError("");
    const open = async () => {
      stream.current?.getTracks().forEach((track) => track.stop());
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
          throw new Error("Camera recording with filters is unavailable in this browser. Try Chrome or Safari, or choose a video instead.");
        }
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true,
        });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof DOMException && e.name === "NotAllowedError"
          ? "Allow camera and microphone access to record a video."
          : e instanceof DOMException && e.name === "NotFoundError"
            ? "No camera or microphone was found on this device."
            : e instanceof Error ? e.message : "Could not open your camera. Please try again.");
      }
    };
    void open();
    return () => { cancelled = true; stream.current?.getTracks().forEach((track) => track.stop()); };
  }, [facing]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  const start = () => {
    const source = video.current;
    const target = canvas.current;
    const media = stream.current;
    if (!source || !target || !media || !source.videoWidth) return;
    const ctx = target.getContext("2d");
    if (!ctx || !("filter" in ctx)) { setError("This browser cannot record filters. Try Chrome or a newer Safari."); return; }
    target.width = source.videoWidth;
    target.height = source.videoHeight;
    const draw = () => {
      ctx.filter = filterRef.current;
      ctx.drawImage(source, 0, 0, target.width, target.height);
      frame.current = requestAnimationFrame(draw);
    };
    try {
      draw();
      const captured = target.captureStream(30);
      media.getAudioTracks().forEach((track) => captured.addTrack(track.clone()));
      output.current = captured;
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(captured, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      let bytes = 0;
      next.ondataavailable = (event) => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes >= 490 * 1024 * 1024 && next.state === "recording") { next.stop(); toast("Recording stopped: video size limit reached."); }
      };
      next.onerror = () => { if (active.current) { setError("Recording failed. Please try again."); setFinishing(false); setRecording(false); } };
      next.onstop = () => {
        cancelAnimationFrame(frame.current);
        captured.getTracks().forEach((track) => track.stop());
        if (!active.current) return;
        setRecording(false);
        setFinishing(false);
        const type = next.mimeType || chunks[0]?.type || "video/webm";
        const blob = new Blob(chunks, { type });
        if (!blob.size) { setError("No video was recorded. Please try again."); return; }
        onCapture(new File([blob], `funtok-camera-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`, { type }));
      };
      recorder.current = next;
      next.start(1000);
      setSeconds(0);
      setRecording(true);
    } catch {
      cancelAnimationFrame(frame.current);
      output.current?.getTracks().forEach((track) => track.stop());
      setError("This device could not start recording. Please try another browser or choose a video.");
    }
  };

  return (
    <div role="dialog" aria-label="Record a video" className="fixed inset-0 z-50 flex flex-col bg-background">
      <video ref={video} muted playsInline className="absolute inset-0 h-full w-full object-cover" style={{ filter }} />
      <canvas ref={canvas} className="hidden" />
      <div className="relative flex items-center justify-between bg-overlay p-3">
        <Button variant="ghost" size="icon" aria-label="Cancel recording" onClick={onClose}><X /></Button>
        <span className="text-sm font-semibold tabular-nums">{recording ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Camera"}</span>
        <Button variant="ghost" size="icon" aria-label="Switch camera" disabled={recording || finishing || !ready} onClick={() => setFacing((s) => s === "user" ? "environment" : "user")}><FlipHorizontal2 /></Button>
      </div>
      {error ? <div role="alert" className="relative m-auto max-w-sm bg-overlay p-5 text-center text-sm">{error}</div> : !ready ? <Loader2 className="relative m-auto h-8 w-8 animate-spin" /> : <div className="flex-1" />}
      <div className="relative space-y-4 bg-overlay px-3 pb-6 pt-4">
        <div aria-label="Camera filters" className="flex flex-wrap justify-center gap-2">
          {FILTERS.map((f) => <Button key={f.name} size="sm" variant={filter === f.css ? "default" : "secondary"} aria-pressed={filter === f.css} disabled={finishing} onClick={() => { filterRef.current = f.css; setFilter(f.css); }}>{f.name}</Button>)}
        </div>
        <div className="flex justify-center">
          <Button size="lg" disabled={!ready || !!error || finishing} onClick={() => {
            if (recording && recorder.current?.state === "recording") { setFinishing(true); recorder.current.stop(); }
            else start();
          }}>{finishing ? <Loader2 className="animate-spin" /> : recording ? <Square /> : <Video />}{finishing ? "Preparing video…" : recording ? "Stop recording" : "Record video"}</Button>
        </div>
      </div>
    </div>
  );
}