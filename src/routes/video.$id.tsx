import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FeedVideo } from "@/lib/feed";
import { Feed } from "@/components/funtok/Feed";

export const Route = createFileRoute("/video/$id")({
  head: () => ({ meta: [
    { title: "Watch on Funtok" },
    { name: "description", content: "Watch this video on the Funtok Fun Side." },
    { property: "og:title", content: "Watch on Funtok" },
    { property: "og:description", content: "Watch this video on the Funtok Fun Side." },
  ] }),
  component: VideoPage,
});

function VideoPage() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["video", id],
    queryFn: async () => (await supabase.from("videos").select("*, profiles(username, display_name, avatar_url)").eq("id", id).maybeSingle()).data as FeedVideo | null,
  });
  return (
    <div className="h-[100dvh]">
      {data ? <Feed entries={[{ kind: "video", video: data }]} /> : <p className="p-10 text-center text-muted-foreground">Loading…</p>}
    </div>
  );
}
