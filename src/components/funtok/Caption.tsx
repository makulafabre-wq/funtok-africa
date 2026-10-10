export function Caption({ text }: { text: string }) {
  const parts = text.split(/([#@][\p{L}\d_.]+)/gu);
  return (
    <p className="text-sm leading-snug">
      {parts.map((p, i) =>
        p.startsWith("#") || p.startsWith("@") ? (
          <span key={i} className="font-semibold text-accent">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}
