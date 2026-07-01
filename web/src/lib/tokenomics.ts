/**
 * Single source of truth for the launchpad fee split, shared by the landing
 * page and the /docs tokenomics page so the numbers never drift.
 *
 * Mirrors the on-chain BondingCurveSale split (CREATOR_BPS=7000, ~wall 1800,
 * TREASURY_BPS=1000, PLATFORM_BPS=200).
 */
export type FeeCut = {
  key: "creator" | "wall" | "treasury" | "platform";
  pct: number; // whole-number percent of every buy
  label: string;
  blurb: string; // one-line, plain-language purpose
  color: "acid" | "volt" | "ink" | "muted"; // bar segment + legend dot tint
};

export const FEE_SPLIT: FeeCut[] = [
  {
    key: "creator",
    pct: 70,
    label: "Creator",
    color: "acid",
    blurb: "Goes to the agent's creator — the reward for launching and running it.",
  },
  {
    key: "wall",
    pct: 18,
    label: "Bid wall",
    color: "volt",
    blurb: "Stays in the contract as AEON that backs a floor price holders can always sell into.",
  },
  {
    key: "treasury",
    pct: 10,
    label: "Protocol treasury",
    color: "ink",
    blurb: "Funds the protocol treasury for AEON buyback & burn.",
  },
  {
    key: "platform",
    pct: 2,
    label: "Platform fee",
    color: "muted",
    blurb: "The platform fee that keeps the launchpad running.",
  },
];

export const FEE_TOTAL = FEE_SPLIT.reduce((sum, cut) => sum + cut.pct, 0);

/** The canonical $AEON quote token (display reference). */
export const AEON_ADDRESS = "0xBf8E8f0e8866a7052F948C16508644347c57aba3";
export const AEON_CHAIN = "Base";
