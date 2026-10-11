import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "./Avatar";

export function CommentsSheet({ videoId, open, onOpenChange, allowComments }: { videoId: string; open: boolean; onOpenChange: (o: boolean) => void; allowComments: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data } = useQuery({
    queryKey: ["comments", videoId],
    enabled: open,
    queryFn: async () =>
      (await supabase.from("comments").select("id, text, created_at, user_id, profiles(username, avatar_url)").eq("video_id", videoId).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const post = async () => {
    if (!user) { toast("Sign in to comment"); return; }
    const t = text.trim();
    if (!t) return;
    setText("");
    const { error } = await supabase.from("comments").insert({ video_id: videoId, user_id: user.id, text: t.slice(0, 500) });
    if (error) { toast.error("Could not post comment"); return; }
    qc.invalidateQueries({ queryKey: ["comments", videoId] });
    qc.invalidateQueries({ queryKey: ["feed"] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl border-border bg-popover p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-center text-sm">{data?.length ?? 0} comments</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {data?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Link to="/profile/$id" params={{ id: c.user_id }}><Avatar url={c.profiles?.avatar_url} name={c.profiles?.username} size={32} /></Link>
              <div>
                <p className="text-xs text-muted-foreground">@{c.profiles?.username}</p>
                <p className="text-sm">{c.text}</p>
              </div>
            </div>
          ))}
          {data?.length === 0 && <p className="pt-10 text-center text-sm text-muted-foreground">Be the first to comment</p>}
        </div>
        {allowComments ? (
          <form onSubmit={(e) => { e.preventDefault(); post(); }} className="flex gap-2 border-t border-border p-3">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={user ? "Add a comment…" : "Sign in to comment"}
              className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <button className="rounded-full bg-primary p-2 text-primary-foreground" aria-label="Send"><Send className="h-4 w-4" /></button>
          </form>
        ) : (
          <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">Comments are turned off</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
