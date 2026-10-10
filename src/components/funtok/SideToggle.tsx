import { Link } from "@tanstack/react-router";
import { useAuth, useConversations } from "@/hooks/use-auth";

/** The big FUN | CHAT switch at the top of the app. */
export function SideToggle({ active, overlay }: { active: "fun" | "chat"; overlay?: boolean }) {
  const { user } = useAuth();
  const { unread } = useConversations(user?.id);
  const tab = (on: boolean) =>
    `relative px-3 pb-1.5 font-display text-sm tracking-wide transition-colors ${on ? "text-foreground" : "text-muted-foreground"} ${overlay ? "text-shadow" : ""}`;
  const bar = <span className="absolute inset-x-3 -bottom-0.5 h-[3px] rounded-full bg-primary" />;
  return (
    <div className="flex items-center justify-center gap-4">
      <Link to="/" className={tab(active === "fun")}>
        FUN {active === "fun" && bar}
      </Link>
      <span className="h-4 w-px bg-border" />
      <Link to="/chat" className={tab(active === "chat")}>
        CHAT
        {unread > 0 && <span className="absolute -right-1 top-0 h-2 w-2 rounded-full bg-primary" />}
        {active === "chat" && bar}
      </Link>
    </div>
  );
}
