import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as tus from "tus-js-client";
import { Camera, Gauge, Loader2, MapPin, Music2, Pause, Play, Smile, Sparkles, Timer, UploadCloud, Users, Wand2, X, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { createUploadTicket } from "@/lib/bunny.functions";
import { BUNNY_CDN, extractTags, thumbUrl } from "@/lib/bunny";
import { exportVideo, VIDEO_FILTERS, videoFilter } from "@/lib/video-edit";
import { CameraRecorder } from "@/components/funtok/CameraRecorder";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [
    { title: "Post a video — Funtok" },
    { name: "description", content: "Record with filters, add your music and post videos to Funtok." },
    { property: "og:title", content: "Post a video — Funtok" },
    { property: "og:description", content: "Record with filters, add your music and post videos to Funtok." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>): { sound?: string } => typeof s["sound"] === "string" ? { sound: s["sound"].slice(0,100) } : {},
  component: UploadPage,
});

type Stage = "pick" | "details" | "preparing" | "uploading" | "saving" | "done";
const TAGS = ["#fyp", "#kampala", "#dance", "#comedy"];
const LOCATIONS = ["Kampala, Uganda", "Entebbe, Uganda", "Jinja, Uganda", "Gulu, Uganda", "Mbarara, Uganda"];
const VIS = [{ id: "public", label: "Everyone" }, { id: "friends", label: "Friends" }, { id: "private", label: "Private" }] as const;
const SPEEDS = [1, 1.5, 2, 0.5];

function UploadPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const queries = useQueryClient();
  const ticketFn = useServerFn(createUploadTicket);
  const fileInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const uploadRef = useRef<tus.Upload | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const completedVideo = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<Stage>("pick");
  const [progress, setProgress] = useState(0);
  const [sound, setSound] = useState(Route.useSearch().sound ?? "Original sound");
  const [music, setMusic] = useState<File | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [soundOpen, setSoundOpen] = useState(false);
  const [location, setLocation] = useState(LOCATIONS[0] ?? "");
  const [visibility, setVisibility] = useState<"public" | "friends" | "private">("public");
  const [filterIdx, setFilterIdx] = useState(0);
  const [beauty, setBeauty] = useState(false);
  const [effect, setEffect] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timer, setTimer] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [clean, setClean] = useState(false);
  const [paused, setPaused] = useState(false);
  const [originalVolume, setOriginalVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.6);
  const busy = ["preparing", "uploading", "saving"].includes(stage);
  const locked = busy || !!completedVideo.current || stage === "done";
  const css = videoFilter(VIDEO_FILTERS[filterIdx]?.css ?? "none", beauty, effect);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { if (musicUrl) URL.revokeObjectURL(musicUrl); }, [musicUrl]);
  useEffect(() => () => { abortRef.current?.abort(); void uploadRef.current?.abort(); }, []);
  useEffect(() => {
    const player = previewRef.current;
    if (!player) return;
    player.playbackRate = speed; player.volume = originalVolume;
  }, [speed, originalVolume, preview]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = musicVolume; }, [musicVolume, musicUrl]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const pickFile = (next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith("video/")) return void toast.error("Please choose a video file.");
    if (next.size > 500 * 1024 * 1024) return void toast.error("Video is too big (max 500 MB).");
    completedVideo.current = null;
    setFile(next); setPreview(URL.createObjectURL(next)); setStage("details"); setClean(false); setPaused(false); setProgress(0);
    setFilterIdx(0); setBeauty(false); setEffect(false); setSpeed(1);
  };
  const syncMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    if (!busy && !paused) void audio.play().catch(() => {});
  };
  const cancel = () => { abortRef.current?.abort(); void uploadRef.current?.abort(); setStage("details"); setProgress(0); };
  const startUpload = async () => {
    if (!user || !file || busy || stage === "done") return;
    const controller = new AbortController(); abortRef.current = controller;
    setClean(false); previewRef.current?.pause(); audioRef.current?.pause(); setProgress(0);
    try {
      let videoId = completedVideo.current;
      if (!videoId) {
        setStage("preparing");
        const prepared = await exportVideo(file, { filter: css, speed, music, originalVolume, musicVolume, signal: controller.signal, onProgress: setProgress });
        if (controller.signal.aborted) return;
        const ticket = await ticketFn({ data: { title: caption.trim() || file.name } });
        if (controller.signal.aborted) return;
        setStage("uploading"); setProgress(0);
        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(prepared, {
            endpoint: "https://video.bunnycdn.com/tusupload", retryDelays: [0,3000,5000,10000],
            headers: { AuthorizationSignature: ticket.signature, AuthorizationExpire: String(ticket.expire), VideoId: ticket.videoId, LibraryId: ticket.libraryId },
            metadata: { filetype: prepared.type, title: caption.trim() || file.name },
            onError: reject, onProgress: (sent,total) => setProgress(Math.round(sent/total*100)), onSuccess: resolve,
          });
          uploadRef.current = upload;
          controller.signal.addEventListener("abort", () => { void upload.abort(); reject(new DOMException("Cancelled","AbortError")); }, { once:true });
          upload.start();
        });
        videoId = ticket.videoId; completedVideo.current = videoId;
      }
      if (controller.signal.aborted) return;
      setStage("saving");
      const { error } = await supabase.from("videos").insert({ user_id:user.id, bunny_video_id:videoId, bunny_cdn_url:BUNNY_CDN, caption:caption.trim(), hashtags:extractTags(caption).hashtags, thumbnail_url:thumbUrl(videoId), location, visibility, sound_name:music ? sound : "Original sound" });
      if (error) throw new Error("Video uploaded, but the post could not be saved. Tap Retry save; your video will not upload again.");
      setStage("done");
      await queries.invalidateQueries({ queryKey:["feed"] });
      await queries.invalidateQueries({ queryKey:["profile", user.id] });
      toast.success("Posted! Your video may take a moment to process.");
      void navigate({ to:"/", search:{} });
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(error instanceof Error ? error.message : "Upload failed. Please try again.");
      setStage("details");
    }
  };

  if (!ready) return <div className="flex h-dvh items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!user) return <div className="flex h-dvh flex-col items-center justify-center gap-4"><h1 className="text-2xl font-bold">Sign in to post</h1><Button asChild><Link to="/auth">Sign in</Link></Button></div>;
  const tools = [
    { icon:Sparkles, label:"Filters", on:filterIdx>0, act:()=>setFilterIdx((v)=>(v+1)%VIDEO_FILTERS.length) },
    { icon:Smile, label:"Beauty", on:beauty, act:()=>setBeauty((v)=>!v) },
    { icon:Wand2, label:"Effects", on:effect, act:()=>setEffect((v)=>!v) },
    { icon:Timer, label:timer ? `${timer}s` : "Timer", on:timer>0, act:()=>setTimer((v)=>v===0?3:v===3?10:0) },
    { icon:Gauge, label:`${speed}x`, on:speed!==1, act:()=>setSpeed(SPEEDS[(SPEEDS.indexOf(speed)+1)%SPEEDS.length] ?? 1) },
  ];
  return <main className="relative mx-auto flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden bg-background">
    {preview ? <video ref={previewRef} src={preview} style={{filter:css}} className={`absolute inset-0 h-full w-full ${clean ? "object-contain" : "object-cover"}`} autoPlay muted={!clean} loop playsInline aria-label="Video preview" onPlay={syncMusic} onPause={()=>audioRef.current?.pause()} onEnded={syncMusic} onError={()=>toast.error("This video format cannot be previewed. Choose another video.")} onClick={()=>{if (!busy) {setClean((v)=>!v);void previewRef.current?.play().catch(()=>{});}}} /> : <div className="absolute inset-0 bg-card" />}
    {musicUrl && <audio ref={audioRef} src={musicUrl} loop />}
    {!clean && <>
      <header className="relative flex shrink-0 items-center gap-2 bg-overlay px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" aria-label="Close" disabled={busy} onClick={()=>void navigate({to:"/"})}><X /></Button>
        <Button variant="secondary" disabled={locked} className="mx-auto min-w-0 max-w-[70%] rounded-full" onClick={()=>setSoundOpen(true)}><Music2 /><span className="truncate">{music ? sound : "Add Sound"}</span></Button>
        <span className="w-9 shrink-0" />
      </header>
      <section className="relative min-h-24 flex-1">
        {!preview ? <div className="flex h-full flex-col items-center justify-center gap-3"><Button onClick={()=>setCameraOpen(true)}><Camera />Open camera</Button><Button variant="secondary" onClick={()=>fileInput.current?.click()}><UploadCloud />Choose a video</Button></div> : <>
          <div className="absolute right-2 top-2 flex max-h-full flex-col gap-1 overflow-y-auto bg-overlay p-1.5">
            {tools.map((tool)=><Button variant="ghost" key={tool.label} disabled={locked} aria-label={tool.label} aria-pressed={tool.on} onClick={tool.act} className={`h-11 flex-col gap-0.5 px-2 text-[10px] ${tool.on ? "text-primary" : ""}`}><tool.icon />{tool.label}</Button>)}
          </div>
          <Button variant="secondary" size="sm" className="absolute bottom-2 left-3" disabled={locked} onClick={()=>fileInput.current?.click()}><UploadCloud />Replace</Button>
        </>}
      </section>
      <section className="relative flex max-h-[55dvh] shrink-0 flex-col border-t border-border bg-overlay backdrop-blur-md">
        <div className="min-h-0 space-y-3 overflow-y-auto p-3">
          <div className="flex items-start gap-2"><textarea aria-label="Caption" value={caption} onChange={(e)=>setCaption(e.target.value)} maxLength={500} disabled={locked} placeholder="Add caption…" rows={2} className="min-w-0 flex-1 resize-none rounded-md bg-card px-3 py-2 text-sm outline-none" /><Button variant="ghost" size="icon" aria-label="Add emoji" disabled={locked} onClick={()=>setCaption((v)=>(v+"😂").slice(0,500))}><Smile /></Button></div>
          <div className="flex flex-wrap gap-2">{TAGS.map((tag)=><Button key={tag} size="sm" variant={caption.split(/\s+/).includes(tag)?"default":"secondary"} disabled={locked} onClick={()=>setCaption((v)=>v.split(/\s+/).includes(tag)?v.split(/\s+/).filter((t)=>t!==tag).join(" "):`${v} ${tag}`.trim().slice(0,500))}>{tag}</Button>)}</div>
          <Button variant="secondary" disabled={locked} className="w-full justify-start" onClick={()=>setSoundOpen(true)}><Music2 /><span className="min-w-0 truncate">{music ? sound : "Add Sound"}</span><span className="ml-auto flex items-center gap-0.5" aria-hidden="true">{[2,4,3,6,4,2,5,3].map((h,i)=><span key={i} className={`w-0.5 bg-primary ${h>4?"h-5":h>2?"h-3":"h-2"}`} />)}</span></Button>
          <label className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0" /><input aria-label="Location" list="post-locations" value={location} disabled={locked} onChange={(e)=>setLocation(e.target.value)} placeholder="Add location" className="min-w-0 flex-1 rounded-md bg-card px-3 py-2" /><datalist id="post-locations">{LOCATIONS.map((loc)=><option key={loc} value={loc} />)}</datalist></label>
          <label className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /><span className="flex-1">Who can view</span><select aria-label="Who can view" value={visibility} disabled={locked} onChange={(e)=>setVisibility(e.target.value as typeof visibility)} className="rounded-md bg-card px-3 py-2">{VIS.map((v)=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
        </div>
        <footer className="shrink-0 space-y-2 border-t border-border px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {busy && <><p role="status" className="text-center text-xs">{stage==="preparing"?`Preparing edits · ${progress}%`:stage==="saving"?"Saving post…":`Uploading · ${progress}%`}</p><progress aria-label="Posting progress" value={progress} max={100} className="h-1 w-full accent-primary" /></>}
          <Button disabled={!file || busy || stage==="done"} size="lg" onClick={()=>void startUpload()} className="w-full bg-gradient-brand font-semibold">{busy?<Loader2 className="animate-spin" />:<UploadCloud />}{completedVideo.current ? "Retry save" : "Post to Fun"}</Button>
          {busy && stage!=="saving" && <Button variant="ghost" size="sm" className="w-full" onClick={cancel}>Cancel</Button>}
        </footer>
      </section>
    </>}
    {clean && <div className="absolute inset-x-3 bottom-4 flex justify-between"><Button variant="secondary" size="icon" aria-label={paused?"Play preview":"Pause preview"} onClick={()=>{const player=previewRef.current;if(!player)return;if(paused){void player.play();}else player.pause();setPaused(!paused);}}>{paused?<Play />:<Pause />}</Button><Button variant="secondary" onClick={()=>setClean(false)}>Done</Button></div>}
    {soundOpen && <div role="dialog" aria-label="Add Sound" className="absolute inset-0 z-30 flex items-end bg-overlay" onClick={()=>setSoundOpen(false)}><div className="max-h-[80dvh] w-full space-y-4 overflow-y-auto bg-card p-4" onClick={(e)=>e.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-semibold">Add Sound</h2><Button variant="ghost" size="icon" aria-label="Close sound picker" onClick={()=>setSoundOpen(false)}><X /></Button></div><Button variant="secondary" className="w-full" onClick={()=>musicInput.current?.click()}><Music2 />Choose audio file</Button>{music && <><p className="truncate text-sm">{sound}</p><audio controls src={musicUrl ?? undefined} className="w-full" /><Button variant="ghost" onClick={()=>{setMusic(null);setMusicUrl(null);setSound("Original sound");}}>Remove music</Button></>}<label className="block space-y-2 text-sm"><span className="flex gap-2"><Volume2 className="h-4 w-4" />Original audio · {Math.round(originalVolume*100)}%</span><input aria-label="Original audio volume" type="range" min="0" max="1" step="0.05" value={originalVolume} onChange={(e)=>setOriginalVolume(Number(e.target.value))} className="w-full accent-primary" /></label>{music && <label className="block space-y-2 text-sm">Music · {Math.round(musicVolume*100)}%<input aria-label="Music volume" type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={(e)=>setMusicVolume(Number(e.target.value))} className="w-full accent-primary" /></label>}<Button className="w-full" onClick={()=>setSoundOpen(false)}>Done</Button></div></div>}
    {cameraOpen && <CameraRecorder initialTimer={timer} onClose={()=>setCameraOpen(false)} onCapture={(recorded)=>{pickFile(recorded);setCameraOpen(false);}} />}
    <input ref={fileInput} type="file" accept="video/*" hidden onChange={(e)=>{pickFile(e.target.files?.[0]??null);e.target.value="";}} />
    <input ref={musicInput} type="file" accept="audio/*" hidden onChange={(e)=>{const f=e.target.files?.[0];if(f){if(!f.type.startsWith("audio/"))toast.error("Choose an audio file.");else{setMusic(f);setMusicUrl(URL.createObjectURL(f));setSound(f.name.replace(/\.[^.]+$/,"").slice(0,100));}}e.target.value="";}} />
  </main>;
}
