import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { thumbUrl, formatCount } from "@/lib/bunny";
import { Avatar } from "@/components/funtok/Avatar";
import { BottomNav } from "@/components/funtok/BottomNav";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({ meta: [
    { title: "Creator profile — Funtok" },
    { name: "description", content: "Watch this creator's videos on Funtok." },
    { property: "og:title", content: "Creator profile — Funtok" },
    { property: "og:description", content: "Watch this creator's videos on Funtok." },
  ] }),
  component: Profile,
});

function Profile() {
  const { id } = Route.useParams();
  const { data: p } = useQuery({ queryKey: ["profile", id], queryFn: async () => (await supabase.from("profiles").select("*").eq("id", id).maybeSingle()).data });
  const { data: vids } = useQuery({ queryKey: ["user-videos", id], queryFn: async () => (await supabase.from("videos").select("id, bunny_video_id, views_count").eq("user_id", id).order("created_at", { ascending: false })).data ?? [] });
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="flex-1">
        <div className="flex flex-col items-center gap-2 px-4 pt-8">
          <Avatar url={p?.avatar_url} name={p?.username} size={96} />
          <p className="font-bold">@{p?.username}</p>
          <div className="flex gap-6 text-center text-sm">
            <span><b>{formatCount(p?.following_count ?? 0)}</b><br />Following</span>
            <span><b>{formatCount(p?.followers_count ?? 0)}</b><br />Followers</span>
            <span><b>{formatCount(p?.likes_count ?? 0)}</b><br />Likes</span>
          </div>
          {p?.bio && <p className="text-sm text-muted-foreground">{p.bio}</p>}
          <Link to="/chat" search={{ user: id }} className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground">Message</Link>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-0.5">
          {vids?.map((v) => (
            <Link key={v.id} to="/video/$id" params={{ id: v.id }} className="aspect-[9/16] bg-card">
              <img src={thumbUrl(v.bunny_video_id)} alt="" className="h-full w-full object-cover" />
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
