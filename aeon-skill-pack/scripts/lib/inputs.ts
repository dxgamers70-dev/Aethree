import type { Json } from "./config-hash";

export type Mode = "dry-run" | "execute";

export interface LaunchInputs {
  name: string;
  symbol: string;
  seedAeon: bigint;
  seedWei: bigint;
  mode: Mode;
  force: boolean;
  avatarURI: string;
  config: Record<string, Json>;
  chainId: number;
}

export const MIN_SEED_AEON = 100_000n;
export const DEFAULT_MAX_SEED_AEON = 250_000n;
const DEFAULT_AVATAR_URI = "ipfs://aethree-placeholder";

export function deriveSymbol(name: string): string {
  const s = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  return s.length > 0 ? s : "AGENT";
}

function fail(msg: string): never {
  throw new Error(`AETHREE_LAUNCH_ERROR — ${msg}`);
}

export function parseInputs(raw: { var: string; env: Record<string, string | undefined> }): LaunchInputs {
  const env = raw.env;
  let text = raw.var ?? "";

  let mode: Mode = "dry-run";
  if (/(^|\s)execute:/i.test(text)) {
    mode = "execute";
    text = text.replace(/(^|\s)execute:/i, " ");
  }
  let force = false;
  if (/(^|\s)force:/i.test(text)) {
    force = true;
    text = text.replace(/(^|\s)force:/i, " ");
  }

  const parts = text.split("|").map((p) => p.trim());
  const name = parts[0] ?? "";
  if (!name) fail("name is required (var: 'NAME | SYMBOL | SEED')");

  const symbol = parts[1] && parts[1].length > 0 ? parts[1].toUpperCase() : deriveSymbol(name);
  if (symbol.length > 11) fail("symbol must be ≤ 11 characters");

  const seedStr = (parts[2] ?? "").replace(/[_,\s]/g, "");
  if (!/^\d+$/.test(seedStr)) fail("seed must be a whole number of AEON (e.g. 100000)");
  const seedAeon = BigInt(seedStr);

  if (seedAeon < MIN_SEED_AEON) fail(`seed ${seedAeon} below minimum ${MIN_SEED_AEON} AEON`);

  const maxSeed = env.AETHREE_MAX_SEED ? BigInt(env.AETHREE_MAX_SEED) : DEFAULT_MAX_SEED_AEON;
  if (seedAeon > maxSeed && !force) {
    fail(`seed ${seedAeon} exceeds max ${maxSeed} AEON — add 'force:' to override`);
  }

  const chainId = env.CHAIN_ID ? Number(env.CHAIN_ID) : 8453;
  const avatarURI = env.AETHREE_AVATAR_URI || DEFAULT_AVATAR_URI;

  const config: Record<string, Json> = {
    persona: env.AETHREE_PERSONA ?? "",
    voice: env.AETHREE_VOICE ?? "",
    policy: {},
    skills: [],
    avatarRef: avatarURI,
  };

  return {
    name,
    symbol,
    seedAeon,
    seedWei: seedAeon * 10n ** 18n,
    mode,
    force,
    avatarURI,
    config,
    chainId,
  };
}
