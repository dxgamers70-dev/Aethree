import { keccak256, toBytes } from "viem";

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export function canonicalJSON(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(",")}}`;
}

export function hashConfig(configCore: Record<string, Json>): `0x${string}` {
  return keccak256(toBytes(canonicalJSON(configCore)));
}
