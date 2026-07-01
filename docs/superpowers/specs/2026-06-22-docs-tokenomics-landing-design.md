# Docs hub (tokenomics) + landing tokenomics refresh — Design

**Date:** 2026-06-22
**Status:** Draft for review

## Overview

Add a `/docs` hub (sidebar layout) whose first page explains the launchpad
tokenomics in plain language, and fix the landing page's now-outdated tokenomics
section so it reflects the shipped AEON model (quote token + 70/18/10/2 split +
bid-wall floor) and links to the new docs.

The landing's current tokenomics block (`src/app/page.tsx` ~lines 254–298)
describes the **old** model ("ETH in escrow backs the curve; sells return down
the same line") and must be replaced.

## Decisions (from brainstorming)

| # | Decision |
|---|---|
| D1 | Docs live at `/docs` as a **hub with a left sidebar**; Tokenomics is the first page. Sidebar is data-driven for easy future pages. |
| D2 | Landing change is **focused**: rewrite the tokenomics section + add Docs links to nav/footer. Hero/USP unchanged. |
| D3 | Docs tone is **accessible** — plain language, minimal math, light on addresses/formulas (one light "floor = pool ÷ circulating" aside; AEON address in a small reference callout). |
| D4 | The 70/18/10/2 split is defined **once** in a shared module and reused by the landing and docs (no drift). |

## Theme

Existing dark theme tokens (from `globals.css`, used across the app):
`bg-void`, `text-ink`, `text-muted`, `text-acid` (green), `text-volt`,
`border-muted/10`, `glow-acid`, `glow-volt`. Components: `Panel`, `Button`
(variants `default` | `volt` | `ghost`), `ConnectWallet`, mono fonts via
`font-mono`. New UI must match these.

## Components & files

### 1. `src/lib/tokenomics.ts` (new) — single source of truth

```ts
export type FeeCut = {
  key: "creator" | "wall" | "treasury" | "platform";
  pct: number;          // whole-number percent
  label: string;        // e.g. "Creator"
  blurb: string;        // one-line purpose
  color: "acid" | "volt" | "ink" | "muted"; // bar/legend tint
};
export const FEE_SPLIT: FeeCut[];   // creator 70, wall 18, treasury 10, platform 2
export const FEE_TOTAL: number;     // sum of pcts (must be 100)
export const AEON_ADDRESS: string;  // "0xBf8E8f0e8866a7052F948C16508644347c57aba3" (display)
export const AEON_CHAIN: string;    // "Base"
```

- `FEE_SPLIT` content (labels + blurbs, accessible tone):
  - **Creator — 70%**: "Goes to the agent's creator — the reward for launching and running it."
  - **Bid wall — 18%**: "Stays in the contract as AEON that backs a floor price holders can always sell into."
  - **Protocol treasury — 10%**: "Funds the protocol treasury for AEON buyback & burn."
  - **Rhegi platform — 2%**: "The Rhegi platform fee that keeps the launchpad running."
- A unit test asserts `FEE_TOTAL === 100` and that `FEE_SPLIT` has exactly the four keys.

### 2. `src/ui/FeeSplitBar.tsx` (new) — reusable split visual

- Presentational, no data fetching. Renders:
  - A single horizontal stacked bar; each segment width = `pct%`, tinted by
    `color`, with the `pct` label inside/!above each segment.
  - A legend (list) of each cut: colored dot, `label`, `pct%`, and `blurb`.
- Props: optional `className`. Reads `FEE_SPLIT` from the shared module.
- Accessible: each segment has an `aria-label` like `"Creator 70%"`.
- RTL test: renders all four labels and their percentages.

### 3. `src/app/docs/layout.tsx` (new) — docs shell

- Slim top bar: `AeThree` logo linking `/`, right side `ConnectWallet` +
  `Deploy agent` button (mirrors landing nav, simplified).
- Two-column body (`max-w-6xl mx-auto`): left **sidebar** (~14rem, hidden on
  small screens / collapses above content), right content (`children`).
- Sidebar is **data-driven** from a local `NAV` array:
  ```ts
  const NAV = [
    { group: "Tokenomics", links: [
      { href: "/docs#aeon", label: "Trade in $AEON" },
      { href: "/docs#split", label: "Fee split" },
      { href: "/docs#floor", label: "The floor" },
      { href: "/docs#seed", label: "Launch seed" },
      { href: "/docs#trading", label: "Buying & selling" },
      { href: "/docs#reference", label: "Reference" },
    ]},
    { group: "More", links: [], note: "More docs coming soon" },
  ];
  ```
  Adding a future page = add a group/links entry (and a sibling route).

### 4. `src/app/docs/page.tsx` (new) — Tokenomics page (accessible)

Sections, each with an `id` matching the sidebar anchors. Uses `Panel` and
`FeeSplitBar`. Plain language, minimal math.

1. `#aeon` **Trade in $AEON** — AEON is the launchpad's currency; every agent
   token is priced as `XYZ/AEON` (like everything trading against ETH/USDC), so
   you need AEON to buy in.
2. `#split` **Where your money goes** — `<FeeSplitBar />` + a short intro that
   every buy is split four ways; the legend carries the per-cut explanation.
3. `#floor` **The floor (bid wall)** — the 18% builds an AEON pool that backs a
   guaranteed sell price; **selling never lowers the floor, buying raises it**;
   one light aside: "the floor per token is just the pool ÷ the tokens in
   circulation."
4. `#seed` **Launch seed** — the creator seeds AEON at launch so there's a real
   floor from day one; a "virtual reserve" keeps the starting price and the
   floor in line so nobody can instantly flip the seed for profit.
5. `#trading` **Buying & selling** — two short 3-step walkthroughs:
   - Buy: approve AEON → buy on the curve → 70/18/10/2 split happens automatically.
   - Sell: approve your tokens → sell → receive AEON from the bid wall at the floor.
6. `#reference` **Reference** — small callout: AEON contract address
   (`AEON_ADDRESS`) on `AEON_CHAIN`, and a note that the full mechanism is
   specified in the repo.

- RTL test: renders the section headings (e.g. "Where your money goes",
  "The floor", "Launch seed").

### 5. `src/app/page.tsx` (modify) — landing fixes

- **Replace** the tokenomics section (the "fair curve / ETH in escrow" block):
  - Heading kept ("The economics") with a new line, e.g. "Priced in $AEON.
    Creators earn, holders get a floor."
  - A short intro paragraph (AEON-quoted; every trade splits four ways; the bid
    wall gives holders a floor).
  - `<FeeSplitBar />`.
  - A one-line bid-wall-floor blurb.
  - A **"Read the tokenomics →"** `Link` to `/docs`.
  - Remove the old curve-preview bar chart and the stale bullet list (esp. the
    "ETH in escrow" line).
- **Nav**: add a `Docs` link (`/docs`) alongside Playground/Launchpad.
- **Footer**: add a `Docs` link.

## Out of scope

- Additional docs pages (Governance, BYO-model) — sidebar is structured to add
  them later; not built now.
- Any contract/economics change — this is presentation only.
- Reworking the hero/USP copy.

## Testing

Targeted Vitest/RTL (run the new files directly; the full suite has a vitest
teardown hang in this environment):
- `tokenomics.test.ts`: `FEE_TOTAL === 100`; `FEE_SPLIT` keys are exactly
  creator/wall/treasury/platform.
- `FeeSplitBar.test.tsx`: renders the four labels and their percentages.
- `docs/page.test.tsx`: renders the key section headings.
- Landing: existing render still holds (smoke).
```
