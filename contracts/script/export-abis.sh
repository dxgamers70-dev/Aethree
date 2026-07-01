#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
forge build
OUT=out/aetherd-abis
mkdir -p "$OUT"
for c in AgentRegistry AgentTokenFactory AgentToken BondingCurveSale AvatarNFT MockAEON; do
  jq '.abi' "out/$c.sol/$c.json" > "$OUT/$c.json"
  echo "exported $OUT/$c.json"
done
