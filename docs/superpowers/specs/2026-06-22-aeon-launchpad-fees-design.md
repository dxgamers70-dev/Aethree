# AEON-quoted launchpad with fee split & bid-wall floor — Design

**Date:** 2026-06-22
**Status:** Draft for review
**Author:** brainstormed with Claude

## Overview

Make **$AEON** the canonical quote token for the launchpad and add a four-way
fee split to every trade, plus a creator-seeded bid wall that acts as the
sell-side floor.

Today `BondingCurveSale` trades agent tokens for **native ETH**, takes **no
fees**, and refunds sells from a full curve reserve. This change:

1. Switches the quote currency from ETH to **AEON** (every agent token trades as
   `XYZ/AEON`, like everything pairing against ETH/USDC).
2. Splits every **buy** four ways: 70% creator, 18% bid wall, 10% treasury,
   2% Rhegi platform.
3. Makes the **bid wall the sole sell-side liquidity** — sells redeem AEON out of
   the wall at a floor price `wall / circulating`.
4. Has the **creator seed AEON at launch**, bootstrapped with **virtual reserves**
   so the floor is real on day one but cannot be arbitraged.

### AEON token (verified on-chain)

- **Address:** `0xBf8E8f0e8866a7052F948C16508644347c57aba3`
- **Chain:** Base mainnet (chainId **8453**)
- **Symbol:** `aeon` · **Decimals:** 18 (matches the agent token — no scaling) ·
  verified ERC-20 (`DERC20`), standard transfer semantics (treated as
  non-fee-on-transfer).

## Decisions (locked during brainstorming)

| # | Decision |
|---|---|
| D1 | Quote currency = AEON (not ETH). Canonical pair `XYZ/AEON`. |
| D2 | Buy split: **70% creator / 18% bid wall / 10% treasury / 2% Rhegi platform**. |
| D3 | Bid wall is the **only** sell-side liquidity. Sells redeem at `wall / circulating`. |
| D4 | Creator **seeds AEON at launch**; seed funds the wall. |
| D5 | Seed safety via **virtual reserves**: `floor = S/V = P0` at launch. |
| D6 | 10% treasury cut is **routed to a treasury address now**; buyback & burn is a separate follow-up (out of scope here). |
| D7 | Real AEON only exists on Base mainnet; use a **mock AEON** for local + Base Sepolia. |

## The mechanism

All amounts in AEON are wei (18 decimals). `sold`, `V`, `MAX_SUPPLY` are **whole
tokens**. Agent token has 18 decimals, so 1 whole token = `1e18` units.

### Launch (createAgent)

The creator provides a **seed** `S` (AEON wei). Protocol fixes a **virtual
circulating supply** `V` (whole tokens). The sale initializes:

```
wall   = S                       // AEON wei held in the contract
sold   = 0                       // real whole tokens released
P0     = S / V                   // AEON wei per whole token (integer div)
floor0 = wall / (V + sold)       // = S / V = P0  at launch
```

So **the day-1 floor equals the curve's starting price.** The seed is pulled
from the creator via `AEON.transferFrom(creator, sale, S)` inside the factory
flow and stays in the contract as the wall.

- `V` default = `MAX_SUPPLY` (1,000,000). Bigger seed ⇒ higher start price &
  deeper floor; one knob for the creator.
- A protocol minimum seed `MIN_SEED` is enforced (factory constant, see Open
  parameters).

### Buy (curve price)

Linear discrete curve, same shape as today, with per-launch `P0`:

```
areaUnder(s) = P0 * s + SLOPE * s*(s-1)/2          // cumulative AEON for first s tokens
cost(N)      = areaUnder(sold + N) - areaUnder(sold)
```

`buy(N)`:
1. `require(sold + N <= MAX_SUPPLY)`.
2. Pull `cost` AEON: `AEON.transferFrom(buyer, sale, cost)`.
3. Split (integer division; **wall takes the residual dust** so AEON accounting
   is exact):
   ```
   creatorCut  = cost * 70 / 100
   treasuryCut = cost * 10 / 100
   platformCut = cost *  2 / 100
   wallCut     = cost - creatorCut - treasuryCut - platformCut   // ~18% + dust
   ```
4. Send `creatorCut → creator`, `treasuryCut → treasury`,
   `platformCut → rhegiPlatform`. `wall += wallCut`.
5. Release tokens: `AGENT.transfer(buyer, N * 1e18)`; `sold += N`.

### Sell (bid-wall floor)

`sell(N)`:
```
circulating = V + sold
payout      = wall * N / circulating          // AEON wei
```
1. `require(N <= sold)`.
2. Pull tokens back: `AGENT.transferFrom(seller, sale, N * 1e18)`; `sold -= N`.
3. `wall -= payout`; `AEON.transfer(seller, payout)`.

**Floor is invariant under sells:** after selling `N`,
`wall' = wall·(circ−N)/circ` and `circ' = circ−N`, so
`wall'/circ' = wall/circ`. Selling drains the wall and circulating
proportionally — the floor price does not move. Buying raises it.

### Why this is arbitrage-free

At launch `floor = S/V = P0`. The first token costs exactly `P0`. Immediately
reselling pays `wall/(V+1) = (S + 0.18·P0)/(V+1)`, which is **less than** `P0`
(since `0.18·S < S`). The 82% that leaves on each buy is the spread; the curve's
`SLOPE` keeps the marginal buy price above the floor as the token grows. No
configuration lets a round-trip profit.

### Invariants

- `wall` ≥ 0 always (payout < wall because `N < V + sold`).
- `V + sold` ≥ `V` ≥ 1 ⇒ **no divide-by-zero** on the floor, even when `sold == 0`.
- Contract AEON balance ≥ `wall` (the only AEON it owes is the wall).
- `sold` ≤ `MAX_SUPPLY`; tokens sold back return to the sale and can be re-bought.

## Contracts

### `BondingCurveSale.sol` (rewrite of trade logic)

New constructor / init state:
- `IERC20 aeon` — quote token.
- `address creator`, `address treasury`, `address rhegiPlatform` — split recipients.
- `uint256 V` — virtual circulating (whole tokens).
- `uint256 P0`, `uint256 SLOPE`, `uint256 MAX_SUPPLY`.
- `uint256 wall` — AEON wei in the bid wall (replaces implicit ETH reserve).

Behavior changes:
- `buy(N)` is **non-payable**; pulls AEON, applies the split (above).
- `sell(N)` pays from the wall at the floor (above).
- Add `floorPrice()` view = `wall * 1e18 / (V + sold)` (AEON wei per whole token,
  scaled for display).
- Add `quoteSell(N)` view = `wall * N / (V + sold)`.
- **Setup split:** the constructor takes
  `(aeon, creator, treasury, rhegiPlatform, P0, SLOPE, MAX_SUPPLY, V)`;
  `initialize(token, seed)` then sets the agent token and `wall = seed`, and is
  called by the factory *after* it has transferred the seed AEON into the sale.
- Use **OpenZeppelin `SafeERC20`** for all AEON/token transfers and
  **`ReentrancyGuard`** (`nonReentrant` on `buy`/`sell`); strict
  checks-effects-interactions ordering.
- Events: `Bought(buyer, amount, cost, creatorCut, wallCut, treasuryCut, platformCut)`,
  `Sold(seller, amount, payout)`.

### `AgentTokenFactory.sol`

- Hold globals as immutables from deploy: `aeon`, `treasury`, `rhegiPlatform`,
  and `MIN_SEED`, `V`, `SLOPE`, `MAX_SUPPLY`.
- `createAgent(name, symbol, avatarURI, configHash, uint256 seed)`:
  - `require(seed >= MIN_SEED)`.
  - Compute `P0 = seed / V`.
  - Deploy sale + token (token mints `MAX_SUPPLY * 1e18` to the sale).
  - Pull seed from creator into the sale: `aeon.transferFrom(msg.sender, sale, seed)`.
    (Creator must `approve` AEON to the factory first — a two-step launch, like trading.)
  - `sale.initialize(token, seed)` with `creator = msg.sender`.
  - Register; emit `AgentCreated`.

### `Deploy.s.sol`

- Read env: `AEON_ADDRESS`, `TREASURY_ADDRESS`, `RHEGI_PLATFORM_ADDRESS`
  (plus existing `DEPLOYER_PRIVATE_KEY`, `EXECUTOR_ADDRESS`).
- Pass them into the factory.
- For local (Anvil) + Base Sepolia: deploy a **`MockAEON`** (mintable ERC-20)
  and use its address; for Base mainnet use the real CA.

### New: `MockAEON.sol` (test/dev only)

- Minimal `ERC20` with public `mint(to, amount)` faucet for local + Sepolia.
- Never deployed to mainnet.

## Web

### `TradePanel.tsx`

- **Buy** becomes two-step like sell: `AEON.approve(sale, cost)` →
  `sale.buy(N)` (no `value`).
- Show: AEON cost to buy, **floor / sell quote** (`quoteSell`), the **fee
  breakdown** (70/18/10/2), the user's **AEON balance** and **allowance**, and
  the bid-wall depth.
- Read `floorPrice()` / `quoteSell()` for the sell side instead of a curve refund.
- Currency labels change from `ETH` to `AEON`.

### Create wizard

- Add a **seed amount (AEON)** field with the `MIN_SEED` minimum, an AEON
  `approve` step before `createAgent`, and copy explaining the seed becomes the
  day-1 floor.

### `lib/contracts`

- `addresses.base-mainnet.json` (chainId 8453) + `AEON` field in each manifest.
- Register Base mainnet in `DEPLOYMENTS` / `activeChain`.
- Add an `AEON` ERC-20 ABI for approve/balance/allowance reads.

## Testing

Foundry (rewrite `BondingCurveSale.t.sol`, extend factory test):
- Buy splits exactly 70/18/10/2 (+ dust to wall); recipients receive AEON;
  `sold`/`wall` update.
- Sell pays `wall·N/(V+sold)`; **floor invariant** across sequences of sells.
- **No-arbitrage fuzz:** for any seed/buy size, an immediate buy→sell round-trip
  returns `< cost`.
- `wall` never goes negative; contract AEON balance ≥ `wall` (invariant fuzz).
- Launch: seed `< MIN_SEED` reverts; `P0 == seed / V`; `floor0 == P0`.
- Divide-by-zero guard: floor reads fine at `sold == 0`.
- Reentrancy: malicious AEON/recipient cannot re-enter `buy`/`sell`.

Web (Vitest/RTL): `TradePanel.test.tsx` — AEON approve→buy path, fee breakdown
render, floor/sell quote display, AEON balance/allowance gating.

## Deployment / chain notes

- Base **mainnet (8453)**: real AEON CA; set `TREASURY_ADDRESS` &
  `RHEGI_PLATFORM_ADDRESS`.
- Base **Sepolia (84532)** + local: deploy `MockAEON`, point the manifest at it.
- Existing mainnet AEON is a Doppler `DERC20`; if it ever exhibits
  fee-on-transfer behavior, switch buy/seed pulls to **balance-delta accounting**
  (measure received). Default assumes standard transfers.

## Open parameters (defaults; confirm on review)

| Param | Default | Note |
|---|---|---|
| `MIN_SEED` | 100,000 AEON (~$2.15) | AEON ≈ $0.0000215; raise for a deeper required floor. |
| `V` (virtual circ) | `MAX_SUPPLY` = 1,000,000 | Sets `P0 = seed / V`. |
| `SLOPE` | revisit (current `1e6`) | Tune relative to `P0` so price climbs sensibly over the sale. |
| `MAX_SUPPLY` | 1,000,000 (unchanged) | |
| `TREASURY_ADDRESS` | deploy env | 10% recipient. |
| `RHEGI_PLATFORM_ADDRESS` | deploy env | 2% recipient. |

## Out of scope (follow-ups)

- **Buyback & burn** of the 10% treasury AEON (separate spec: swap/burn target,
  keeper/cadence).
- Curve-parameter economic tuning beyond making it safe & coherent.
- Secondary market / DEX listing after the curve completes.
```
