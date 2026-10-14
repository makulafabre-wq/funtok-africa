import { useEffect, useRef, useState } from "react";
import { Smile, Paperclip, Send, Mic, Image as ImageIcon, Camera, FileText, MapPin, X, Square, Download } from "lucide-react";
import { toast } from "sonner";
import { uploadChatFile, chatFileUrl } from "@/lib/chat";

const EMOJIS = "😀 😂 🤣 😊 😍 🥰 😘 😎 🤩 🥳 😇 🙂 😉 😜 🤪 🤔 🤗 🙄 😏 😴 😢 😭 😡 🤯 😱 🥺 😅 😬 🙏 👏 👍 👎 👌 ✌️ 🤝 💪 🙌 👋 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 💯 🔥 ✨ 🎉 🎶 💃 🕺 🌍 🇺🇬 ⚽ 🍌 🍗 🍺 ☕ 🌹 🌞 🌙 ⭐ 💰 📱 🎥 📸 🚀 😆 🤭 😋 😌 🤑 🥲 😤 😳 🤤".split(" ");

type Payload = { text?: string; imageUrl?: string; audioUrl?: string; fileUrl?: string; fileName?: string };

export function ChatComposer({ cid, me, onSend, onType }: { cid: string; me: string; onSend: (p: Payload) => Promise<void>; onType: (v: string) => void }) {
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<"none" | "emoji" | "attach">("none");
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const doc = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!rec) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [rec]);

  const upload = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) { toast.error("File too big (max 25 MB)"); return; }
    setBusy(true); setPanel("none");
    try {
      const path = await uploadChatFile(cid, me, file, file.name);
      if (file.type.startsWith("image/")) await onSend({ imageUrl: path });
      else if (file.type.startsWith("audio/")) await onSend({ audioUrl: path, fileName: file.name });
      else await onSend({ fileUrl: path, fileName: file.name });
    } catch (e) { toast.error((e as Error).message || "Upload failed"); } finally { setBusy(false); }
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); };

  const sendText = async () => {
    const t = text.trim(); if (!t) return;
    setText(""); setPanel("none");
    await onSend({ text: t.slice(0, 2000) });
  };

  const shareLocation = () => {
    setPanel("none");
    if (!navigator.geolocation) { toast.error("Location not available"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => void onSend({ text: `📍 My location: https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}` }),
      () => toast.error("Allow location access to share it"),
    );
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (mr.state === "inactive" && (mr as MediaRecorder & { cancelled?: boolean }).cancelled) return;
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
        setBusy(true);
        try { const path = await uploadChatFile(cid, me, blob, `voice_${Date.now()}.webm`); await onSend({ audioUrl: path }); }
        catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
      };
      mr.start(); setSecs(0); setRec(mr);
    } catch { toast.error("Allow microphone access to send voice notes"); }
  };
  const stopRec = (cancel = false) => { if (!rec) return; (rec as MediaRecorder & { cancelled?: boolean }).cancelled = cancel; rec.stop(); setRec(null); };

  return (
    <div className="border-t border-border pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {panel === "emoji" && (
        <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto p-2 text-2xl">
          {EMOJIS.map((e) => <button key={e} type="button" onClick={() => { setText((t) => t + e); input.current?.focus(); }} className="rounded-lg p-1 hover:bg-secondary">{e}</button>)}
        </div>
      )}
      {panel === "attach" && (
        <div className="grid grid-cols-4 gap-3 p-4 text-xs">
          <AttachBtn icon={<ImageIcon className="h-6 w-6" />} label="Gallery" onClick={() => gallery.current?.click()} />
          <AttachBtn icon={<Camera className="h-6 w-6" />} label="Camera" onClick={() => camera.current?.click()} />
          <AttachBtn icon={<FileText className="h-6 w-6" />} label="Document" onClick={() => doc.current?.click()} />
          <AttachBtn icon={<MapPin className="h-6 w-6" />} label="Location" onClick={shareLocation} />
        </div>
      )}
      <input ref={gallery} type="file" accept="image/*" hidden onChange={pick} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={doc} type="file" hidden onChange={pick} />
      {busy && <p className="px-4 pt-1 text-xs text-muted-foreground">Sending…</p>}
      {rec ? (
        <div className="flex items-center gap-3 p-2">
          <button type="button" onClick={() => stopRec(true)} aria-label="Cancel recording" className="rounded-full p-2.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
          <p className="flex-1 text-sm"><span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />Recording {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</p>
          <button type="button" onClick={() => stopRec(false)} aria-label="Send voice note" className="rounded-full bg-primary p-3 text-primary-foreground"><Square className="h-4 w-4" /></button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void sendText(); }} className="flex items-center gap-1.5 p-2">
          <div className="flex flex-1 items-center rounded-full bg-secondary px-1">
            <button type="button" aria-label="Emoji" onClick={() => setPanel((p) => (p === "emoji" ? "none" : "emoji"))} className="p-2 text-muted-foreground"><Smile className="h-5 w-5" /></button>
            <input ref={input} value={text} onChange={(e) => { setText(e.target.value); onType(e.target.value); }} onFocus={() => setPanel((p) => (p === "attach" ? "none" : p))} placeholder="Message…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
            <button type="button" aria-label="Attach" onClick={() => setPanel((p) => (p === "attach" ? "none" : "attach"))} className="p-2 text-muted-foreground"><Paperclip className="h-5 w-5" /></button>
          </div>
          {text.trim() ? (
            <button className="rounded-full bg-primary p-3 text-primary-foreground" aria-label="Send"><Send className="h-4 w-4" /></button>
          ) : (
            <button type="button" onClick={startRec} className="rounded-full bg-primary p-3 text-primary-foreground" aria-label="Record voice note"><Mic className="h-4 w-4" /></button>
          )}
        </form>
      )}
    </div>
  );
}

function AttachBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground">{icon}</span>
      {label}
    </button>
  );
}

function useSigned(path?: string | null) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (path) chatFileUrl(path).then(setUrl); }, [path]);
  return url;
}

export function MediaContent({ imageUrl, audioUrl, fileUrl, fileName }: { imageUrl?: string | null | undefined; audioUrl?: string | null | undefined; fileUrl?: string | null | undefined; fileName?: string | null | undefined }) {
  const img = useSigned(imageUrl);
  const aud = useSigned(audioUrl);
  const file = useSigned(fileUrl);
  return (
    <>
      {imageUrl && (img ? <a href={img} target="_blank" rel="noreferrer"><img src={img} alt="Photo" className="max-h-80 w-64 object-cover" /></a> : <div className="h-48 w-64 animate-pulse bg-card" />)}
      {audioUrl && <div className="px-2 pt-2"><audio controls src={aud || undefined} className="h-10 w-60" /></div>}
      {fileUrl && (
        <a href={file || undefined} target="_blank" rel="noreferrer" download={fileName ?? undefined} className="m-2 flex items-center gap-3 rounded-xl bg-overlay px-3 py-2.5">
          <FileText className="h-7 w-7 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm">{fileName ?? "File"}</span>
          <Download className="h-4 w-4 shrink-0" />
        </a>
      )}
    </>
  );
}
