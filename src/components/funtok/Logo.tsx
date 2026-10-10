import { Link } from "@tanstack/react-router";
import { Sparkle } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className={`relative flex items-center justify-center bg-brand ${box}`}>
        <Sparkle className="h-1/2 w-1/2 fill-primary-foreground text-primary-foreground" />
        <span className="absolute -bottom-1 left-1.5 h-2 w-2 rotate-45 bg-accent" />
      </span>
      <span className={`font-display font-bold tracking-tight ${size === "sm" ? "text-lg" : "text-2xl"}`}>Funtok</span>
    </Link>
  );
}
