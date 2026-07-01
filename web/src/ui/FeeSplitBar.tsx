import { FEE_SPLIT } from "@/lib/tokenomics";

const TINT: Record<string, string> = {
  acid: "bg-acid",
  volt: "bg-volt",
  ink: "bg-ink",
  muted: "bg-muted",
};

/** A stacked bar + legend visualising the 70/18/10/2 fee split on every buy. */
export function FeeSplitBar({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-9 w-full overflow-hidden rounded-lg border border-ink/10">
        {FEE_SPLIT.map((c) => (
          <div
            key={c.key}
            className={`${TINT[c.color]} flex items-center justify-center`}
            style={{ width: `${c.pct}%` }}
            aria-label={`${c.label} ${c.pct}%`}
            title={`${c.label} ${c.pct}%`}
          >
            {c.pct >= 10 && (
              <span className="text-[10px] font-mono font-bold text-void">{c.pct}%</span>
            )}
          </div>
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {FEE_SPLIT.map((c) => (
          <li key={c.key} className="flex items-start gap-3 text-sm">
            <span className={`${TINT[c.color]} mt-1 h-3 w-3 shrink-0 rounded-sm`} aria-hidden />
            <span>
              <span className="font-bold">{c.label}</span>
              <span className="font-mono text-muted"> · {c.pct}%</span>
              <span className="block text-muted">{c.blurb}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
