---
name: Launch Token (AeThree)
category: crypto
description: Launch an agent token on the AeThree launchpad (Base) — seed in AEON, dry-run by default, bounded live opt-in
var: ""
requires: [AETHREE_LAUNCHER_PRIVATE_KEY]
capabilities: [onchain_writes, external_api]
---

> **${var}** — `NAME | SYMBOL | SEED` (SYMBOL optional, auto-derived; SEED in whole AEON, ≥ 100,000).
> Prefix with `execute:` to broadcast for real. Add `force:` to exceed `AETHREE_MAX_SEED`.
> Default (no `execute:`) is a **dry-run**: it simulates and prints the predicted token/sale, sends nothing.

## When to use

Use when asked to launch / deploy / create a token (agent) on the AeThree launchpad on Base.
This skill spends real funds (≥ 100,000 AEON + gas) in execute mode — **never** run `execute:`
without explicit human intent for this specific launch.

## Secrets

| Secret | Purpose |
|--------|---------|
| `AETHREE_LAUNCHER_PRIVATE_KEY` | Funded EOA (holds ≥ seed AEON + ETH for gas). Never printed. |

Optional env: `BASE_RPC_URL` (default `https://mainnet.base.org`), `AETHREE_MAX_SEED` (default 250000),
`CHAIN_ID` (default 8453), `AETHREE_AVATAR_URI`, `AETHREE_PERSONA`, `AETHREE_VOICE`.

## Steps

### 1. Install deps (first run only)

```bash
npm --prefix aeon-skill-pack install --silent
```

### 2. Dry-run first (always)

```bash
npm --prefix aeon-skill-pack run -s launch -- "${var}"
```

Read the printed plan: launcher address, AEON balance vs. seed, and the **predicted** token/sale.
If anything looks wrong (wrong chain, insufficient balance, wrong seed), stop and report.

### 3. Execute only on explicit go

Only if the human has clearly approved this launch, re-run with the `execute:` prefix:

```bash
npm --prefix aeon-skill-pack run -s launch -- "execute: ${var}"
```

On success the skill prints `AETHREE_LAUNCH_OK` and a JSON object with `token`, `sale`,
`agentId`, the tx hash, and Basescan links. Report those back. On any failure it prints
`AETHREE_LAUNCH_ERROR — <reason>` and exits non-zero; surface the reason and do not retry blindly.

## Guardrails

- Dry-run is the default; `execute:` is required to spend.
- Seed must be within `[100000, AETHREE_MAX_SEED]` AEON unless `force:` is given.
- The factory is approved for the **exact** seed only.
- Base mainnet factory: `0x758c73C9e22639F4fe54301D039e155Dc7380B8c`; AEON: `0xBf8E8f0e8866a7052F948C16508644347c57aba3`.
