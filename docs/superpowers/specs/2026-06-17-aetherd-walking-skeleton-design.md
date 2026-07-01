# AeTherD — Walking Skeleton (Slice 1) — Design

- **Date:** 2026-06-17
- **Status:** Approved (design); pending spec review
- **Slice:** 1 of N — "Walking Skeleton" (thin end-to-end vertical)
- **Reference / prior art:** [nirholas/three.ws](https://github.com/nirholas/three.ws) — open-source 3D AI agent platform (text/image→3D, Claude brain, on-chain identity, embeddable `<agent-3d>`). AeTherD overlaps the agent+avatar space but is defined by a **governance-token launchpad where holders actually mutate the agent**.

---

## 1. Product vision

AeTherD is a launchpad where you **create an AI agent, give it a 3D face, and launch a governance token for that agent** — and holders of the token **vote to change the agent itself** (its persona, skills, behavior), with every change verifiable on-chain.

The 3D avatar is the agent's *face*. The token is a *governance stake* in that agent. The launchpad is how the stake is minted and distributed. What makes it more than a memecoin: **a passing vote verifiably mutates a live agent.**

### Locked product decisions

| Decision | Choice |
|---|---|
| Goal | Real product, v1 — built in slices |
| Token ↔ agent | Ownership & governance — a micro-DAO per agent; votes mutate the agent |
| Chain | Base (ERC20Votes + OpenZeppelin patterns; custom bonding-curve launchpad; avatar as ERC-721) |
| Avatar source | Curated rigged customizer — base bodies pre-rigged with skeletal animation + ARKit-52 blendshapes (this slice: *pick* from a curated set, no full customizer yet) |
| Governance execution | Off-chain token-weighted vote → Executor applies a typed mutation → new config hash anchored on-chain |

---

## 2. Scope of this slice

Prove the **entire core loop end-to-end on Base Sepolia testnet**, shallow in every subsystem. The point of the walking skeleton is to de-risk the scary integration — an off-chain agent ↔ an on-chain token ↔ a governance loop — before deepening any single subsystem.

**Real money / mainnet is explicitly a later hardening slice, gated on a contract audit.**

### The end-to-end flow

1. **Create** — connect wallet (SIWE), create an agent: `name` + one `persona` field (the system prompt) + pick a 3D avatar from a small curated set (N base bodies). Produces **agent config v1** (content-addressed by hash).
2. **Launch** — one transaction deploys the token and registers the agent: `AgentTokenFactory` → `AgentToken` (ERC20Votes) + `BondingCurveSale` + mints an `AvatarNFT`, all recorded in `AgentRegistry` with the agent id, config hash, and avatar ref.
3. **Acquire stake** — others connect and `buy()` tokens along the bonding curve with test ETH; they self-delegate to activate voting power.
4. **Propose & vote** — a holder creates one typed proposal kind: `edit_persona` (new system-prompt text). Voting is **off-chain + gasless**: balances are snapshotted at the proposal's creation block (`getPastVotes`); holders vote yes/no with an EIP-712 signature. Simple quorum + majority + deadline.
5. **Execute** — after the deadline, the **Executor** (server keeper) tallies, applies the winning mutation → builds **agent config v2** (new hash) → calls `AgentRegistry.setConfigHash(agentId, newHash)` on-chain (executor-role gated). The change is anchored.
6. **Interact** — anyone opens the agent page: a three.js avatar (idle animation + TTS-driven lip-sync) and a chat box. The chat runtime loads the **current** config (v2), so the persona change is live; the config hash links to the on-chain anchor tx for verifiability.

---

## 3. Architecture & components

### Frontend — Next.js (App Router) on Vercel
- **Pages:** `/` (agent gallery), `/create` (create + launch wizard), `/agent/[id]` (avatar viewer + chat + trade panel + governance panel).
- **Wallet/auth:** wagmi + viem + SIWE → server session.
- **3D:** `<AvatarViewer>` React component wrapping three.js — `GLTFLoader` + Draco for the GLB, `AnimationMixer` for idle animation, morph-target (blendshape) updates for TTS-driven lip-sync.
- **Visual direction — "degen":** dark-first, high-contrast neon accents (acid green / electric purple), oversized bold display type with **monospace for all numerics** (prices, supply, vote weights, % quorum), glow + gradient surfaces, a live **ticker / marquee** of recent launches & trades, chunky tactile buttons, candle/curve price viz, crypto-native microcopy, and tasteful motion (framer-motion). Lean meme-native and energetic — explicitly *not* corporate/SaaS-clean — while keeping the **buy/sell and vote** actions unmistakable. Tailwind for styling; a small reusable component kit so every page shares the look.

### Backend — Vercel route handlers
- **Agent Core** — agent CRUD + content-addressed config versioning; exposes "current config" by `agentId`.
- **Chat runtime** — `POST /api/agent/[id]/chat`: loads current config, calls Claude (Anthropic API) with `persona` as the system prompt, streams the response; optional TTS for avatar speech. No agent tools/skills in this slice (persona-driven chat only).
- **Governance** — create proposal / cast vote / tally.
- **Executor** — cron-triggered keeper that finds passed-and-ended proposals, applies the mutation, and anchors the new config hash on-chain.

### Smart contracts — Base Sepolia (Foundry / Solidity, on OpenZeppelin)
- **`AgentRegistry`** — `agentId → {creator, token, sale, avatarTokenId, configHash}`. `register(...)` (called by factory) and `setConfigHash(agentId, hash)` gated to `EXECUTOR_ROLE`. Emits `AgentRegistered` and `ConfigHashUpdated` events.
- **`AgentTokenFactory`** — deploys `AgentToken` + `BondingCurveSale`, mints the `AvatarNFT`, and registers the agent in one call.
- **`AgentToken`** — OZ `ERC20Votes`, fixed max supply minted to the sale contract.
- **`BondingCurveSale`** — holds the token supply; `buy()` / `sell()` priced on a simple curve vs test ETH; tracks reserve. DEX graduation is **out of scope** for the skeleton (noted as TODO).
- **`AvatarNFT`** — OZ `ERC721`, minted at launch; `tokenURI` → avatar metadata (the chosen base avatar ref).

### Storage
- **Neon Postgres** — agents, configs, proposals, votes, sessions.
- **Vercel Blob / Cloudflare R2** — curated avatar GLBs + metadata.

### Intentional skeleton simplifications
- No subgraph indexer — read token price/holders directly via viem.
- Avatar is *picked* from a curated set, not *customized*.
- Only the `edit_persona` proposal type exists.

---

## 4. Data model (Neon Postgres)

- **`agents`** — `id`, `creator_addr`, `name`, `current_config_id`, `token_address`, `sale_address`, `avatar_token_id`, `created_at`
- **`agent_configs`** — `id`, `agent_id`, `version`, `hash`, `persona`, `skills` (jsonb, empty this slice), `policy` (jsonb), `voice`, `avatar_ref`, `anchored_tx`, `created_at`. **Content-addressed:** `hash = keccak256(canonicalJSON(config))`.
- **`proposals`** — `id`, `agent_id`, `type` (`edit_persona`), `payload` (jsonb), `snapshot_block`, `deadline`, `status` (`active` → `passed`/`failed` → `executed`), `created_by`, `for_weight`, `against_weight`, `executed_config_id`, `executed_tx`
- **`votes`** — `id`, `proposal_id`, `voter_addr`, `weight`, `choice`, `signature`, `created_at`; **unique `(proposal_id, voter_addr)`**
- **`sessions`** — SIWE nonce / session

---

## 5. The vote → mutate data flow (the differentiator)

1. A holder creates a proposal → server records `snapshot_block = currentBlock` and `deadline`.
2. Each vote: server verifies the EIP-712 signature, reads `weight = AgentToken.getPastVotes(voter, snapshot_block)` (weight is frozen at the snapshot, so buying more after voting does not help), rejects duplicates, accumulates `for_weight` / `against_weight`.
3. After `deadline`: the Executor checks **quorum** (≥ X% of snapshot supply voted) and **majority** (`for_weight > against_weight`) → sets `passed` or `failed`.
4. On `passed`: the Executor loads config v1, applies `payload` (the new persona) → builds **config v2**, computes its hash, writes the row, then calls `AgentRegistry.setConfigHash(agentId, v2.hash)`. On tx confirmation it sets `agents.current_config_id = v2`, stores `executed_tx`, and marks the proposal `executed`.
5. The chat runtime always reads `agents.current_config_id`, so the persona change is live; the agent page links `hash → executed_tx` on Basescan for verifiability.

---

## 6. Error handling / edge cases

- **Bad signature / not a holder at snapshot** → reject the vote.
- **Double vote** → DB unique constraint; weight is fixed at the snapshot block.
- **Executor idempotency** → act only on `passed && !executed`; guard with an atomic status transition. If the on-chain write fails, leave the proposal `passed-not-anchored` and retry with nonce management — **never apply a mutation twice**.
- **Config / hash mismatch** → before flipping `current_config_id`, assert the on-chain `configHash` equals the stored v2 hash.
- **LLM timeout / error** → graceful chat error; rate-limit chat per session.
- **Curve reverts** (slippage / empty reserve) → surface the revert reason in the trade UI.

---

## 7. Testing strategy

- **Contracts (Foundry)** — factory deploys token + sale + avatar + registry entry; only `EXECUTOR_ROLE` can `setConfigHash`; bonding-curve buy/sell invariants (reserve never underflows; round-trip within tolerance); ERC20Votes snapshot correctness.
- **Backend (unit)** — deterministic canonical config hashing; vote-weight calc against `getPastVotes`; tally + quorum logic; Executor idempotency.
- **Integration (Anvil local chain)** — full path: create → launch → buy → propose → vote → execute → assert `current_config_id == v2` and the on-chain hash matches.
- **E2E (Playwright)** — the same loop through the UI, asserting the chat reply reflects the new persona after execution.

---

## 8. Out of scope for this slice (each a later spec)

Full avatar customizer + text-to-3D "Forge"; subgraph indexer; DEX graduation; mainnet; treasury / multi-type governance; agent tools / skills marketplace; reputation; embeddable widget.

### Future slices (build order, indicative)
2. **Avatar Studio** — full three.js customizer (base body + options), TTS lip-sync polish, GLB pipeline, avatar metadata.
3. **Launchpad depth** — richer bonding curve, graduation to a DEX pool, indexer, trade UX, mainnet + audit.
4. **Governance depth** — more typed proposal types (add/remove skill, set policy, treasury), quorum tuning, proposal lifecycle UX.

---

## 9. Open questions / risks

- **Bonding-curve shape & parameters** — exact pricing function, fees, and supply split need to be specified before contract work (linear vs other; creator allocation; sale reserve handling).
- **Quorum / majority parameters** — concrete `X%` quorum and voting period length (and whether they're per-agent configurable).
- **Executor trust** — in this slice the Executor is a trusted server key with `EXECUTOR_ROLE`. Anchoring makes changes *verifiable* but not *trustless*; decentralizing execution is a later concern.
- **Snapshot accuracy** — relies on `ERC20Votes.getPastVotes`; voters must self-delegate to have voting power (a known ERC20Votes footgun — surface it in the buy/vote UX).
- **Avatar licensing** — the curated base-body GLBs must be sourced with commercial-use rights.
