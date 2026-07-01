# AeThree `launch-token` Aeon Skill Pack — Design

**Goal:** Ship a self-contained Aeon **skill pack** that lets an autonomous Aeon agent launch an agent token on the AeThree launchpad (Base mainnet, chain 8453) **without the web UI** — signing with a dedicated launcher key, dry-run by default, with an explicit, bounded opt-in to spend real funds.

**Status:** Approved design (2026-06-27). Next step: implementation plan via `writing-plans`.

**Tech Stack:** TypeScript + [viem](https://viem.sh) (run via `tsx`); Solidity contracts already deployed on Base 8453; Aeon skill format (`SKILL.md` + `skills-pack.json`); Vitest + a local anvil fork for integration tests.

---

## Context

AeThree (aethree.xyz) is a launchpad on Base where a launch deploys, in one transaction, an avatar NFT + an ERC20Votes agent token + an AEON-quoted bonding-curve sale. The on-chain entrypoint is permissionless:

```solidity
// contracts/src/AgentTokenFactory.sol:49
function createAgent(
    string calldata name,
    string calldata symbol,
    string calldata avatarURI,
    bytes32 configHash,
    uint256 seed
) external returns (uint256 agentId, address token, address sale)
```

- **Prerequisite:** caller must `approve` the factory to pull `seed` AEON before calling `createAgent` (factory does `aeon.safeTransferFrom(msg.sender, sale, seed)`).
- **`seed`** is denominated in AEON (18 decimals), minimum `MIN_SEED = 100_000e18` (100,000 AEON). It sets the bid-wall floor and start price `P0 = seed / V`, `V = 1_000_000`.
- **Event:** `AgentCreated(uint256 indexed agentId, address indexed creator, address token, address sale, uint256 seed)` — parsed to recover the new token/sale addresses.
- **Deployed addresses (Base 8453)** — `web/src/lib/contracts/abis/addresses.base-mainnet.json`:
  - AEON `0xBf8E8f0e8866a7052F948C16508644347c57aba3`
  - AgentTokenFactory `0x758c73C9e22639F4fe54301D039e155Dc7380B8c`
  - AgentRegistry `0x7fd3Fe93504664DA43a82B9a6A70E292Bd2c00eB`
  - AvatarNFT `0xf5F498eA77C0bd95f933a76212063BB5814C90e1`

The web app today (`web/src/ui/LaunchPanel.tsx`) does **approve → simulate → write → POST `/api/agents/[id]/launch`** (the POST only records the launch in the AeThree DB against a pre-existing *draft* agent row). The skill reproduces the on-chain half only.

### Decisions locked during brainstorming

1. **Form factor:** an Aeon **skill pack** (portable `SKILL.md` + script), not a Claude Code skill or a generic SDK.
2. **Signing model:** a **dedicated launcher key** read from the `AETHREE_LAUNCHER_PRIVATE_KEY` secret; signs locally with viem (works headless in GitHub Actions). No Base MCP dependency; no custodial backend.
3. **Off-chain integration:** **on-chain only / self-contained.** The skill computes its own `configHash` and `avatarURI` from inputs and calls `createAgent` directly. It does **not** touch the AeThree DB/API. Consequence (accepted): the token is live and tradeable on its bonding curve and visible on Basescan, but will **not** appear in the AeThree web app unless event-indexing or a record step is added later.
4. **Location:** authored under **`aeon-skill-pack/`** in this (aetherd) repo now; mirrored to / listed from a standalone public repo later for the Aeon Community-packs listing.

---

## Architecture

A single skill, `launch-token`, plus a thin viem script it drives. The `SKILL.md` is the agent-facing contract (when to use, inputs, guardrails, ordered steps); `scripts/launch.ts` does the deterministic on-chain work and emits machine-readable output.

```
aeon-skill-pack/
  skills/launch-token/SKILL.md     # agent-facing: frontmatter, inputs, guardrails, steps
  scripts/launch.ts                # viem: preflight → approve → simulate → createAgent → parse event
  scripts/lib/config-hash.ts       # mirrors web/src/lib/config-hash.ts (canonicalJSON + keccak256)
  scripts/lib/contracts.ts         # ABIs + Base addresses (vendored from web/src/lib/contracts)
  scripts/lib/inputs.ts            # parse ${var}/env, validate, derive symbol, seed/chain guards
  skills-pack.json                 # install manifest (docs/community-skill-packs.md schema)
  package.json  tsconfig.json      # deps: viem; scripts run via tsx
  README.md  LICENSE               # MIT
```

**Vendoring:** the factory + AEON ERC20 ABIs and the Base-mainnet address map are **copied** into `scripts/lib/contracts.ts` (with a header comment pointing at the canonical `web/src/lib/contracts/abis/` source and a note to keep them in sync). This keeps the pack portable to a standalone repo without importing from `web/`.

### Units & responsibilities

- **`SKILL.md`** — decides intent, gathers inputs, enforces the dry-run-by-default / explicit-opt-in policy, and invokes `scripts/launch.ts`. Contains no signing logic.
- **`scripts/lib/inputs.ts`** — pure functions: parse `${var}`, read env, validate, derive `symbol` from `name`, enforce seed bounds and chain guard. Independently unit-testable.
- **`scripts/lib/config-hash.ts`** — `canonicalJSON` + `hashConfig` byte-for-byte identical to `web/src/lib/config-hash.ts`. Golden-tested against it.
- **`scripts/lib/contracts.ts`** — exports ABIs + address map keyed by chainId.
- **`scripts/launch.ts`** — orchestrates clients, preflight, simulate, approve, write, parse; emits JSON. The only unit that sends transactions.

---

## Inputs

| Source | Name | Required | Notes |
|--------|------|----------|-------|
| secret (env) | `AETHREE_LAUNCHER_PRIVATE_KEY` | yes | Funded EOA holding ≥ `seed` AEON + ETH for gas. Never printed/logged. |
| `${var}` | `name`, `symbol`, `seed` | name+seed required | Accepts `NAME \| SYMBOL \| SEED` or natural language. `symbol` auto-derived from `name` if omitted. `seed` in whole AEON (≥ 100,000). |
| `${var}`/env | persona, voice, policy, skills, `avatarURI` | optional | Feed `configHash`; `avatarURI` defaults to a placeholder URI when absent. |
| env | `BASE_RPC_URL` | optional | Default `https://mainnet.base.org`. |
| env | `AETHREE_MAX_SEED` | optional | Upper seed bound; **default 250,000 AEON**. Exceeding it requires `--force`. |
| env | `CHAIN_ID` | optional | Default `8453`. `84532` (Base Sepolia) supported for testing. |

**Mode:** dry-run is the default. Live execution requires an explicit opt-in token (`execute:` prefix / `--execute`) in the skill arg, mirroring `distribute-tokens` and `hunch-bet` in the Aeon catalog.

---

## Data flow

1. **Parse & validate** `${var}` + env (`inputs.ts`). Validate name/symbol length, seed ≥ `MIN_SEED`, seed ≤ `AETHREE_MAX_SEED` (unless `--force`), and chain.
2. **Build config & hash:** `config = {persona, voice, policy, skills, avatarRef}` → `canonicalJSON` → `keccak256` = **configHash**; resolve **avatarURI**.
3. **Preflight (read-only):** launcher address; AEON balance ≥ seed; ETH-for-gas > 0; current allowance; start price `seed / V`. Print a human-readable plan.
4. **Simulate:** `simulateContract(createAgent, [name, symbol, avatarURI, configHash, seedWei])` → predicted `agentId`, `token`, `sale` + revert check.
5. **If dry-run (default):** print plan + simulated result and **stop — no state-changing tx sent.**
6. **If `execute:`:**
   a. `approve(AEON → factory, seedWei)` — skipped when existing allowance ≥ seed; approve **exact** seed, never unlimited. Wait for receipt.
   b. `writeContract(createAgent, …)` (from the simulated request). Wait for receipt.
   c. Parse **`AgentCreated`** from logs → `token`, `sale`, `agentId`.
   d. Emit JSON `{ txHash, token, sale, agentId, basescan: {…} }` and a success notification.

---

## Safety & error handling

- **Dry-run by default**; live spend only on explicit `execute:` opt-in.
- **Bounded spend:** reject `seed > AETHREE_MAX_SEED` (default 250,000 AEON) unless `--force`; approve the exact seed only.
- **Fail closed** with `AETHREE_LAUNCH_ERROR — <reason>` and a non-zero exit, sending **no** transaction, on: missing/invalid key, insufficient AEON, no gas, simulate revert, or chain mismatch.
- **No secret leakage:** the private key is read from env only and never printed; logs show the derived address, not the key.
- **Idempotency:** append each completed launch to `memory/state/aethree-launches.json` (keyed by name + nonce) to guard against accidental re-launch within a run; success/error surfaced with the `AETHREE_LAUNCH_OK` / `AETHREE_LAUNCH_ERROR` convention used by other Aeon skills.

---

## `skills-pack.json` manifest (install protocol)

```json
{
  "name": "AeThree Launchpad",
  "version": "0.1.0",
  "description": "Launch agent tokens on the AeThree launchpad (Base) from an Aeon agent",
  "author": "aethree_xyz",
  "license": "MIT",
  "homepage": "https://aethree.xyz",
  "skills": [
    {
      "slug": "launch-token",
      "path": "skills/launch-token",
      "description": "Launch an agent token on AeThree — seed in AEON, dry-run by default, bounded live opt-in",
      "category": "crypto",
      "default_enabled": false,
      "secrets_required": ["AETHREE_LAUNCHER_PRIVATE_KEY"],
      "secrets_optional": ["BASE_RPC_URL", "AETHREE_MAX_SEED", "CHAIN_ID"],
      "capabilities": ["onchain_writes", "external_api"]
    }
  ]
}
```

### `SKILL.md` frontmatter

```yaml
name: Launch Token (AeThree)
category: crypto
description: Launch an agent token on the AeThree launchpad (Base) — seed in AEON, dry-run by default, bounded live opt-in
var: ""
requires: [AETHREE_LAUNCHER_PRIVATE_KEY]
capabilities: [onchain_writes, external_api]
```

---

## Testing

- **Unit (`inputs.ts`):** `${var}` parsing (delimited + natural language), symbol derivation, seed-bound and chain guards, error messages.
- **Unit (`config-hash.ts`):** golden test asserting byte-identical output to `web/src/lib/config-hash.ts` for shared fixtures.
- **Integration:** anvil fork of Base mainnet (or Base Sepolia + `MockAEON`) — fund the launcher, run `execute:`, assert `approve` + `createAgent` succeed and the parsed `AgentCreated` `token`/`sale` match the simulated result and on-chain code exists. Reuses the pattern in `web/src/test/integration/full-loop.test.ts`.
- **Dry-run test:** asserts **zero** state-changing transactions are sent in default mode.
- **Installer compatibility:** `SKILL.md` passes Aeon's `install-skill-pack` security scanner (no HIGH findings).

---

## Out of scope (YAGNI)

- AeThree DB/app integration (on-chain only, per decision 3) — token won't show in the web app until a later indexing/record step.
- Buy/sell/trading skills (separate skill later).
- IPFS / avatar upload pipeline — the skill accepts an `avatarURI` and otherwise uses a placeholder.
- Base MCP signing path.
- **Listing in Aeon's Community packs** (README row + `skill-packs.json` entry in `aaronjmars/aeon`) — a follow-up PR once the pack is in a public repo.
