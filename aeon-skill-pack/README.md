# aeon-skill-pack-aethree

An [Aeon](https://github.com/aaronjmars/aeon) skill pack that lets an autonomous agent
**launch agent tokens on the [AeThree](https://aethree.xyz) launchpad** (Base mainnet) —
without the web UI.

A launch deploys, in one transaction, an avatar NFT + an ERC20Votes agent token + an
AEON-quoted bonding-curve sale via the AeThree `AgentTokenFactory`
(`0x758c73C9e22639F4fe54301D039e155Dc7380B8c` on Base 8453). Tokens are seeded and quoted
in **$AEON** (`0xBf8E8f0e8866a7052F948C16508644347c57aba3`), minimum **100,000 AEON**.

## Skills

| Skill | What it does |
|-------|--------------|
| [`launch-token`](skills/launch-token/SKILL.md) | Launch an agent token on AeThree — `approve` AEON → `createAgent`, parse `AgentCreated`. Dry-run by default; explicit `execute:` opt-in to spend. |

## Install

Via the Aeon installer, from your Aeon instance:

```bash
# from a standalone repo:
./install-skill-pack <owner>/aeon-skill-pack-aethree
# or, if vendored as a subdir of another repo:
./install-skill-pack <owner>/<repo> --path aeon-skill-pack
```

The installer reads `skills-pack.json`, security-scans each `SKILL.md`, and copies the skill
into `skills/` **disabled** — nothing runs until you set the secret below and enable it in `aeon.yml`.

## Secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `AETHREE_LAUNCHER_PRIVATE_KEY` | yes | Funded EOA holding ≥ seed AEON + ETH for gas. Signs locally; never printed. |
| `BASE_RPC_URL` | no | Defaults to `https://mainnet.base.org`. |
| `AETHREE_MAX_SEED` | no | Upper seed bound in whole AEON (default `250000`). Exceed with a `force:` token. |
| `CHAIN_ID` | no | Defaults to `8453` (Base mainnet). |
| `AETHREE_AVATAR_URI`, `AETHREE_PERSONA`, `AETHREE_VOICE` | no | Feed the on-chain avatar URI / config hash. |

## Safety model

- **Dry-run by default.** `npm run launch -- "Name | SYM | 100000"` only simulates and prints the
  predicted token/sale — it sends **no** transaction. Add the `execute:` prefix to broadcast.
- **Bounded.** Seed must be within `[100000, AETHREE_MAX_SEED]` AEON unless a `force:` token is given.
  The factory is approved for the **exact** seed, never unlimited.
- **Fail closed.** Missing key, insufficient AEON/gas, simulate revert, or wrong chain → exits non-zero
  with a leading `AETHREE_LAUNCH_ERROR — <reason>` and sends nothing.

## Caveat (on-chain only)

This pack launches purely on-chain. The token is live and tradeable on its bonding curve and
visible on Basescan immediately, but it will **not** appear in the AeThree web app until AeThree
indexes the `AgentCreated` event (or a record step is added). That's a deliberate v1 scope choice.

## Development

```bash
npm install
npm test                 # unit suite (no network, no funds)
RUN_INTEGRATION=1 npm run test:integration   # gated anvil test
```

## License

MIT
