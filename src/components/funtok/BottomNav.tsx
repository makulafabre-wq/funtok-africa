import { Link } from "@tanstack/react-router";
import { Clapperboard, MessageCircle, Plus, User, Flame } from "lucide-react";
import { useAuth, useConversations } from "@/hooks/use-auth";

export function BottomNav() {
  const { user } = useAuth();
  const { unread } = useConversations(user?.id);
  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium";
  const active = { className: "text-foreground" };
  const inactive = { className: "text-muted-foreground" };
  return (
    <nav className="relative z-30 flex items-end border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <Link to="/" activeOptions={{ exact: true, includeSearch: false }} activeProps={active} inactiveProps={inactive} className={item}>
        <Clapperboard className="h-6 w-6" /> Fun
      </Link>
      <Link to="/" search={{ tab: "trending" }} activeOptions={{ includeSearch: true }} activeProps={active} inactiveProps={inactive} className={item}>
        <Flame className="h-6 w-6" /> Trending
      </Link>
      <Link to="/upload" className="flex flex-1 items-center justify-center py-2" aria-label="Upload">
        <span className="flex h-9 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
          <Plus className="h-6 w-6" strokeWidth={3} />
        </span>
      </Link>
      <Link to="/chat" activeProps={active} inactiveProps={inactive} className={item}>
        <span className="relative">
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
        Chat
      </Link>
      {user ? (
        <Link to="/profile/$id" params={{ id: user.id }} activeProps={active} inactiveProps={inactive} className={item}>
          <User className="h-6 w-6" /> Profile
        </Link>
      ) : (
        <Link to="/auth" activeProps={active} inactiveProps={inactive} className={item}>
          <User className="h-6 w-6" /> Sign in
        </Link>
      )}
    </nav>
  );
}
