import Link from "next/link";
import { Button } from "@/ui/Button";
import { ConnectWallet } from "@/ui/ConnectWallet";
import { Brand } from "@/ui/Brand";

type NavGroup = {
  group: string;
  links: { href: string; label: string }[];
  note?: string;
};

const NAV: NavGroup[] = [
  {
    group: "Tokenomics",
    links: [
      { href: "/docs#aeon", label: "Trade in $AEON" },
      { href: "/docs#split", label: "Fee split" },
      { href: "/docs#floor", label: "The floor" },
      { href: "/docs#seed", label: "Launch seed" },
      { href: "/docs#trading", label: "Buying & selling" },
      { href: "/docs#reference", label: "Reference" },
    ],
  },
  { group: "More", links: [], note: "More docs coming soon" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="sticky top-0 z-20 backdrop-blur bg-void/70 border-b border-muted/10">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-3">
            <Link href="/launchpad" className="hidden sm:inline text-xs font-mono uppercase text-muted hover:text-ink">Launchpad</Link>
            <Link href="/playground" className="hidden sm:inline text-xs font-mono uppercase text-muted hover:text-ink">Playground</Link>
            <ConnectWallet />
            <Link href="/create"><Button>+ Deploy agent</Button></Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-[14rem_1fr] gap-10">
        <aside className="md:sticky md:top-20 md:self-start">
          <div className="text-xs font-mono uppercase tracking-widest text-acid mb-3">Docs</div>
          <nav className="space-y-5">
            {NAV.map((g) => (
              <div key={g.group}>
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">{g.group}</div>
                {g.links.length > 0 ? (
                  <ul className="space-y-1.5">
                    {g.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="text-sm text-muted hover:text-acid">{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs italic text-muted/70">{g.note}</p>
                )}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
