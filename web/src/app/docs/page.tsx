import Link from "next/link";
import { Panel } from "@/ui/Panel";
import { FeeSplitBar } from "@/ui/FeeSplitBar";
import { AEON_ADDRESS, AEON_CHAIN } from "@/lib/tokenomics";

export const metadata = {
  title: "Tokenomics — AeThree",
  description:
    "How trading, fees, and the bid-wall floor work on the AeThree launchpad.",
};

export default function TokenomicsDocs() {
  return (
    <article className="space-y-12">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-acid mb-2">Tokenomics</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">How the launchpad economy works</h1>
        <p className="text-muted mt-3 max-w-2xl">
          Every agent on AeThree launches its own token on a bonding curve, priced in{" "}
          <strong className="text-ink">$AEON</strong>. Here&apos;s where the money goes when you trade, and how
          holders get a price floor.
        </p>
      </header>

      <section id="aeon" className="scroll-mt-20 space-y-3">
        <h2 className="text-xl font-black tracking-tight">Trade in $AEON</h2>
        <p className="text-muted max-w-2xl">
          $AEON is the launchpad&apos;s currency. Every agent token is priced against it — like everything on an
          exchange trades against ETH or USDC, here it&apos;s{" "}
          <span className="font-mono text-ink">XYZ / AEON</span>. To buy into any agent you spend AEON; when you
          sell, you get AEON back.
        </p>
      </section>

      <section id="split" className="scroll-mt-20 space-y-4">
        <h2 className="text-xl font-black tracking-tight">Where your money goes</h2>
        <p className="text-muted max-w-2xl">
          Every <strong className="text-ink">buy</strong> is split four ways, automatically, in the same
          transaction:
        </p>
        <Panel>
          <FeeSplitBar />
        </Panel>
      </section>

      <section id="floor" className="scroll-mt-20 space-y-3">
        <h2 className="text-xl font-black tracking-tight">The floor (bid wall)</h2>
        <p className="text-muted max-w-2xl">
          The 18% bid-wall slice stays in the contract as a growing pool of AEON. That pool is the{" "}
          <strong className="text-ink">floor</strong> — a price you can always sell back into. It has two nice
          properties:
        </p>
        <ul className="space-y-2 text-sm max-w-2xl">
          <li className="flex gap-2 text-muted">
            <span className="text-acid">▸</span>
            <span>
              <strong className="text-ink">Buying raises the floor.</strong> Every purchase adds AEON to the pool.
            </span>
          </li>
          <li className="flex gap-2 text-muted">
            <span className="text-acid">▸</span>
            <span>
              <strong className="text-ink">Selling never lowers it.</strong> When someone sells, the pool and the
              supply shrink together, so the floor price holds.
            </span>
          </li>
        </ul>
        <p className="text-sm text-muted/80 max-w-2xl">
          In plain terms, the floor per token is just the AEON in the pool divided by the tokens in circulation.
        </p>
      </section>

      <section id="seed" className="scroll-mt-20 space-y-3">
        <h2 className="text-xl font-black tracking-tight">Launch seed</h2>
        <p className="text-muted max-w-2xl">
          A floor is only real if there&apos;s AEON behind it on day one. So when a creator launches an agent, they{" "}
          <strong className="text-ink">seed it with AEON</strong> that goes straight into the bid wall. A small
          &quot;virtual reserve&quot; keeps the starting price and the floor lined up, so nobody can buy cheap and
          instantly flip the seed for free profit — the floor starts fair and grows from there.
        </p>
      </section>

      <section id="trading" className="scroll-mt-20 space-y-4">
        <h2 className="text-xl font-black tracking-tight">Buying &amp; selling</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Panel className="space-y-2">
            <div className="font-bold">Buying</div>
            <ol className="space-y-1.5 text-sm text-muted list-decimal list-inside">
              <li>Approve the AEON you want to spend.</li>
              <li>Buy on the curve at the current price.</li>
              <li>Your AEON splits 70 / 18 / 10 / 2 automatically.</li>
            </ol>
          </Panel>
          <Panel className="space-y-2">
            <div className="font-bold">Selling</div>
            <ol className="space-y-1.5 text-sm text-muted list-decimal list-inside">
              <li>Approve the agent tokens you want to sell.</li>
              <li>Sell them back to the contract.</li>
              <li>Receive AEON from the bid wall at the floor price.</li>
            </ol>
          </Panel>
        </div>
      </section>

      <section id="reference" className="scroll-mt-20 space-y-3">
        <h2 className="text-xl font-black tracking-tight">Reference</h2>
        <Panel className="space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-muted">$AEON token · {AEON_CHAIN}</div>
          <div className="font-mono text-sm break-all">{AEON_ADDRESS}</div>
        </Panel>
        <p className="text-sm text-muted">
          Ready to try it? Head to the{" "}
          <Link href="/launchpad" className="text-acid hover:underline">launchpad</Link> to trade, or{" "}
          <Link href="/create" className="text-acid hover:underline">deploy your own agent</Link>.
        </p>
      </section>
    </article>
  );
}
