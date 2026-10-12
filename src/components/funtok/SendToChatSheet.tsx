import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth, useConversations } from "@/hooks/use-auth";
import { sendMessage } from "@/lib/chat";
import { Avatar } from "./Avatar";

export function SendToChatSheet({ open, onOpenChange, bunnyVideoId, videoRowId }: { open: boolean; onOpenChange: (o: boolean) => void; bunnyVideoId: string; videoRowId: string }) {
  const { user } = useAuth();
  const { conversations } = useConversations(user?.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl border-border bg-popover">
        <SheetHeader><SheetTitle>Send to Chat Side</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-1 overflow-y-auto">
          {!user && <p className="text-sm text-muted-foreground"><Link to="/auth" className="text-primary">Sign in</Link> to send videos.</p>}
          {user && conversations.length === 0 && <p className="text-sm text-muted-foreground">No chats yet — open someone's profile and tap Message.</p>}
          {user && conversations.map((c) => {
            const other = c.participants.find((p) => p !== user.id) ?? user.id;
            const info = c.participantInfo?.[other];
            return (
              <button key={c.id} onClick={async () => {
                await sendMessage(c, user.id, { videoShareId: bunnyVideoId, videoRowId });
                toast.success(`Sent to ${info?.displayName ?? "chat"}`);
                onOpenChange(false);
              }} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-secondary">
                <Avatar url={info?.avatarUrl} name={info?.displayName} />
                <span className="flex-1 text-sm font-medium">{info?.displayName ?? "Chat"}</span>
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Send</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
