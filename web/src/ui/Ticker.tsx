export function Ticker({ items }: { items: string[] }) {
  const row = items.length ? items : ["no launches yet — be the first to deploy an agent"];
  return (
    <div className="overflow-hidden border-y border-muted/15 bg-panel/60">
      <div className="flex gap-8 whitespace-nowrap py-2 animate-[scroll_30s_linear_infinite] font-mono text-xs text-muted">
        {row.concat(row).map((t, i) => (
          <span key={i} className="uppercase tracking-wider">▸ {t}</span>
        ))}
      </div>
    </div>
  );
}
