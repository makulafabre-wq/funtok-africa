export function Avatar({ url, name, size = 40, ring, online }: { url?: string | null | undefined; name?: string | null | undefined; size?: number; ring?: boolean; online?: boolean }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-brand font-display font-bold text-accent-foreground ${ring ? "ring-2 ring-foreground" : ""}`}
      >
        {url ? <img src={url} alt={name ?? ""} className="h-full w-full object-cover" /> : initial}
      </span>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-background ${online ? "bg-online" : "bg-muted-foreground/50"}`}
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
        />
      )}
    </span>
  );
}
