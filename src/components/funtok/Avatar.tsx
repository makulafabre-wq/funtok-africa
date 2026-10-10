export function Avatar({ url, name, size = 40, ring }: { url?: string | null; name?: string | null; size?: number; ring?: boolean }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand font-display font-bold text-accent-foreground ${ring ? "ring-2 ring-foreground" : ""}`}
    >
      {url ? <img src={url} alt={name ?? ""} className="h-full w-full object-cover" /> : initial}
    </span>
  );
}
