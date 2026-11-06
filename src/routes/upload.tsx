import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { AudioLines, Camera, ChevronRight, Gauge, Hash, Loader2, MapPin, Music2, Smile, Sparkles, Timer, UploadCloud, Users, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { createUploadTicket } from "@/lib/bunny.functions";
import { BUNNY_CDN, extractTags, thumbUrl } from "@/lib/bunny";
import { CameraRecorder } from "@/components/funtok/CameraRecorder";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [
    { title: "Post a video — Funtok" },
    { name: "description", content: "Upload a video to the Funtok Fun Side." },
    { property: "og:title", content: "Post a video — Funtok" },
    { property: "og:description", content: "Upload a video to the Funtok Fun Side." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>): { sound?: string } => (typeof s["sound"] === "string" && s["sound"] ? { sound: s["sound"].slice(0, 100) } : {}),
  component: UploadPage,
});

type Stage = "pick" | "details" | "uploading" | "done";

function UploadPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<tus.Upload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<Stage>("pick");
  const [progress, setProgress] = useState(0);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState<string | null>(Route.useSearch().sound ?? null);
  const [soundOpen, setSoundOpen] = useState(false);
  const [locIdx, setLocIdx] = useState(0);
  const [visibility, setVisibility] = useState<"public" | "friends" | "private">("public");
  const [filterIdx, setFilterIdx] = useState(0);
  const [beauty, setBeauty] = useState(false);
  const [effect, setEffect] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [clean, setClean] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFile = (f: File | null): void => {
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast.error("Please choose a video file."); return; }
    if (f.size > 500 * 1024 * 1024) { toast.error("Video is too big (max 500 MB)."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStage("details");
  };

  const reset = (): void => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setCaption(""); setProgress(0); setStage("pick");
  };

  const startUpload = async (): Promise<void> => {
    if (!user || !file) return;
    setStage("uploading");
    try {
      const ticket = await createUploadTicket({ data: { title: caption || file.name } });
      await new Promise<void>((resolve, reject) => {
        const up = new tus.Upload(file, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000],
          headers: {
            AuthorizationSignature: ticket.signature,
            AuthorizationExpire: String(ticket.expire),
            VideoId: ticket.videoId,
            LibraryId: ticket.libraryId,
          },
          metadata: { filetype: file.type, title: caption || file.name },
          onError: (err) => reject(err),
          onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
          onSuccess: () => resolve(),
        });
        uploadRef.current = up;
        up.start();
      });

      const { hashtags } = extractTags(caption);
      const { error } = await supabase.from("videos").insert({
        user_id: user.id,
        bunny_video_id: ticket.videoId,
        bunny_cdn_url: BUNNY_CDN,
        caption: caption.trim(),
        hashtags,
        thumbnail_url: thumbUrl(ticket.videoId),
        location: LOCATIONS[locIdx] ?? "Kampala, Uganda",
        visibility,
      });
      if (error) throw error;
      setStage("done");
      toast.success("Your video is posted! 🎉");
      setTimeout(() => { void navigate({ to: "/" }); }, 1200);
    } catch (e) {
      console.error(e);
      toast.error("Upload failed. Please try again.");
      setStage("details");
    }
  };

  if (!ready) return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-display text-2xl font-bold">Sign in to post</p>
        <p className="text-sm text-muted-foreground">You need an account to share videos on Funtok.</p>
        <Link to="/auth" className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">Sign in</Link>
      </div>
    );
  }

  const toggleTag = (t: string): void => {
    const re = new RegExp(`(^|\\s)${t}(?=\\s|$)`);
    setCaption((c) => (re.test(c) ? c.replace(re, "").trim() : `${c.trim()} ${t}`.trim()));
  };
  const filter = FILTERS[filterIdx] ?? FILTERS[0];
  const tools = [
    { icon: Sparkles, label: "Filters", on: filterIdx > 0, act: () => { const n = (filterIdx + 1) % FILTERS.length; setFilterIdx(n); toast(`Filter: ${FILTERS[n]?.name ?? "None"}`); } },
    { icon: Smile, label: "Beauty", on: beauty, act: () => setBeauty((b) => !b) },
    { icon: Wand2, label: "Effects", on: effect, act: () => setEffect((e) => !e) },
    { icon: Timer, label: "Timer", on: false, act: () => toast("Timer works when recording with the camera") },
    { icon: Gauge, label: `${speed}x`, on: speed !== 1, act: () => { const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1; setSpeed(n); if (previewRef.current) previewRef.current.playbackRate = n; } },
  ];
  const css = [filter?.css ?? "", beauty ? "brightness(1.08) contrast(0.95) saturate(1.1)" : "", effect ? "hue-rotate(40deg) saturate(1.6)" : ""].join(" ");

  return (
    <div className="relative mx-auto h-[100dvh] w-full max-w-md overflow-hidden bg-background">
      {preview ? (
        <video ref={previewRef} src={preview} style={{ filter: css }} className="absolute inset-0 h-full w-full object-cover" muted={!clean} loop autoPlay playsInline onClick={() => { setClean((c) => !c); void previewRef.current?.play().catch(() => {}); }} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card/50 pb-40">
          <Button size="lg" onClick={() => setCameraOpen(true)}><Camera /> Open camera</Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}><UploadCloud /> Choose a video</Button>
        </div>
      )}

      {!clean && <><div className="absolute inset-x-3 top-3 flex items-center rounded-3xl border border-border/50 bg-overlay px-3 py-3 backdrop-blur-md">
        <button onClick={() => { if (stage !== "uploading") { reset(); void navigate({ to: "/" }); } }} className="rounded-full border border-border/60 p-2.5" aria-label="Close"><X className="h-5 w-5" /></button>
        <button onClick={() => setSoundOpen(true)} className="mx-auto flex items-center gap-2 rounded-full border border-border/60 bg-overlay px-4 py-2 text-sm font-semibold">
          <Music2 className="h-4 w-4" /> {sound ?? "Add Sound"} <AudioLines className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="w-10" />
      </div>

      {preview && (
        <div className="absolute right-2 top-20 flex max-h-[calc(45dvh-5rem)] flex-col gap-2 overflow-y-auto rounded-3xl border border-border/50 bg-overlay px-1.5 py-2 sm:right-3 sm:top-28 sm:gap-4 sm:px-2 sm:py-4 backdrop-blur-md">
          {tools.map((t) => (
            <button key={t.label} onClick={t.act} className={`flex flex-col items-center gap-1 text-[11px] font-semibold ${t.on ? "text-primary" : ""}`}>
              <t.icon className="h-5 w-5 sm:h-6 sm:w-6" /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="absolute inset-x-2 bottom-2 max-h-[55dvh] space-y-1.5 overflow-y-auto rounded-3xl border border-border/50 bg-overlay p-2.5 backdrop-blur-md sm:inset-x-3 sm:bottom-3 sm:space-y-2 sm:p-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 px-3 py-2.5">
          <Hash className="h-5 w-5" />
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} disabled={stage !== "details" && stage !== "pick"} placeholder="Add caption..." className="flex-1 bg-transparent text-sm outline-none" />
          <button onClick={() => setCaption((c) => c + "😂")} aria-label="Add emoji"><Smile className="h-5 w-5" /></button>
        </div>
        <button onClick={() => setSoundOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-card/60 px-3 py-2.5 text-sm font-semibold">
          <Music2 className="h-5 w-5" /> <span className="whitespace-nowrap">{sound ?? "Add Sound"}</span>
          <span className="flex flex-1 items-center justify-end gap-[2px]">
            {WAVE.map((h, i) => <span key={i} className="w-[2px] rounded-full bg-gradient-brand" style={{ height: h }} />)}
          </span>
          <ChevronRight className="h-4 w-4 text-primary" />
        </button>
        <div className="flex items-center gap-2 rounded-2xl bg-card/60 px-3 py-2.5 text-sm font-semibold">
          <Hash className="h-5 w-5 shrink-0" /> <span className="whitespace-nowrap">Add Hashtag</span>
          <div className="scrollbar-none flex flex-1 justify-end gap-1.5 overflow-x-auto">
            {TAGS.map((t) => {
              const on = new RegExp(`(^|\\s)${t}(?=\\s|$)`).test(caption);
              return <button key={t} onClick={() => toggleTag(t)} className={`rounded-lg px-2 py-1 text-xs ${on ? "bg-gradient-brand text-primary-foreground" : "bg-muted"}`}>{t}</button>;
            })}
          </div>
        </div>
        <button onClick={() => setLocIdx((i) => (i + 1) % LOCATIONS.length)} className="flex w-full items-center gap-3 rounded-2xl bg-card/60 px-3 py-2 text-left">
          <MapPin className="h-5 w-5" />
          <span className="flex-1"><span className="block text-xs text-muted-foreground">Add Location</span><span className="text-sm font-semibold">{LOCATIONS[locIdx]}</span></span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card/60 px-3 py-2">
          <Users className="h-5 w-5" />
          <span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">Who can view</span><span className="text-sm font-semibold">{VIS.find((v) => v.id === visibility)?.label ?? "Everyone"}</span></span>
          <div className="flex rounded-lg bg-muted p-0.5 text-xs">
            {VIS.map((v) => <button key={v.id} onClick={() => setVisibility(v.id)} className={`rounded-md px-2 py-1 ${visibility === v.id ? "bg-background font-semibold" : "text-muted-foreground"}`}>{v.label}</button>)}
          </div>
        </div>

        {stage === "uploading" && (
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${progress}%` }} /></div>
        )}
        <button onClick={() => (file ? void startUpload() : fileInput.current?.click())} disabled={stage === "uploading" || stage === "done"}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand py-2.5 font-display text-xl sm:py-3.5 sm:text-2xl font-bold text-primary-foreground disabled:opacity-80">
          {stage === "uploading" ? <><Loader2 className="h-6 w-6 animate-spin" /> {progress}%</> : stage === "done" ? "Posted! 🎉" : file ? "Post to Fun" : "Choose video"}
        </button>
      </div></>}
      {clean && <p className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs text-muted-foreground">Tap video to show tools</p>}

      {soundOpen && (
        <div className="absolute inset-0 z-30 flex items-end bg-overlay" onClick={() => setSoundOpen(false)}>
          <div className="w-full space-y-1 rounded-t-3xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 font-display text-lg font-bold">Add Sound</p>
            {[null, ...SOUNDS].map((s) => (
              <button key={s ?? "orig"} onClick={() => { setSound(s); setSoundOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${sound === s ? "bg-muted font-semibold" : ""}`}>
                <Music2 className="h-4 w-4 text-primary" /> {s ?? "Original sound"}
              </button>
            ))}
          </div>
        </div>
      )}

      {cameraOpen && <CameraRecorder onClose={() => setCameraOpen(false)} onCapture={(recorded) => {
        setFilterIdx(0); setBeauty(false); setEffect(false); setSpeed(1);
        pickFile(recorded); setCameraOpen(false);
      }} />}
      <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
    </div>
  );
}

const TAGS = ["#fyp", "#kampala", "#dance", "#comedy"];
const LOCATIONS = ["Kampala, Uganda", "Entebbe, Uganda", "Jinja, Uganda", "Gulu, Uganda", "Mbarara, Uganda"];
const VIS = [{ id: "public", label: "Everyone" }, { id: "friends", label: "Friends" }, { id: "private", label: "Private" }] as const;
const SOUNDS = ["Kampala Vibes · Afrobeat", "Gwe Wuuyo · Dancehall", "Comedy Drum Roll", "Amapiano Night"];
const FILTERS = [{ name: "None", css: "" }, { name: "Warm", css: "sepia(0.3) saturate(1.3)" }, { name: "Cool", css: "hue-rotate(-15deg) saturate(1.2)" }, { name: "B&W", css: "grayscale(1)" }, { name: "Vivid", css: "saturate(1.8) contrast(1.1)" }];
const SPEEDS = [1, 1.5, 2, 0.5];
const WAVE = Array.from({ length: 40 }, (_, i) => 4 + Math.round(Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 16));
