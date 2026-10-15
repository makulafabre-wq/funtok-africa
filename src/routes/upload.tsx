import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as tus from "tus-js-client";
import { Film, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { createUploadTicket } from "@/lib/bunny.functions";
import { BUNNY_CDN, extractTags, thumbUrl } from "@/lib/bunny";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [
    { title: "Post a video — Funtok" },
    { name: "description", content: "Upload a video to the Funtok Fun Side." },
    { property: "og:title", content: "Post a video — Funtok" },
    { property: "og:description", content: "Upload a video to the Funtok Fun Side." },
  ] }),
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

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Post a video</h1>
        {stage !== "uploading" && (
          <button onClick={() => void navigate({ to: "/" })} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {stage === "pick" && (
        <button
          onClick={() => fileInput.current?.click()}
          className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card/50 py-24 text-center"
        >
          <UploadCloud className="h-14 w-14 text-primary" />
          <p className="font-semibold">Choose a video</p>
          <p className="text-xs text-muted-foreground">MP4 or any video · up to 500 MB</p>
        </button>
      )}

      {(stage === "details" || stage === "uploading" || stage === "done") && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="relative mx-auto aspect-[9/16] w-40 overflow-hidden rounded-xl bg-black">
            {preview && <video src={preview} className="h-full w-full object-cover" muted loop autoPlay playsInline />}
            {stage === "details" && (
              <button onClick={reset} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5" aria-label="Remove video">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption… #funtok #kampala"
            maxLength={500}
            rows={3}
            disabled={stage !== "details"}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
          />

          {stage === "uploading" && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-center text-xs text-muted-foreground">Uploading… {progress}%</p>
            </div>
          )}

          {stage === "done" && (
            <p className="text-center text-sm font-semibold text-green-400">Posted! Taking you to the Fun Side…</p>
          )}

          {stage === "details" && (
            <button
              onClick={() => void startUpload()}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground"
            >
              <Film className="h-5 w-5" /> Post to Fun Side
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
