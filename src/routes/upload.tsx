import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [
    { title: "Post a video — Funtok" },
    { name: "description", content: "Upload a video to the Funtok Fun Side." },
    { property: "og:title", content: "Post a video — Funtok" },
    { property: "og:description", content: "Upload a video to the Funtok Fun Side." },
  ] }),
  component: () => (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="font-display text-2xl font-bold">Posting is coming next</p>
      <p className="text-sm text-muted-foreground">The upload screen isn't finished yet.</p>
      <Link to="/" className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">Back to Fun Side</Link>
    </div>
  ),
});
