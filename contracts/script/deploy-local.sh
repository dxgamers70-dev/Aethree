#!/usr/bin/env bash
# Deploy AeTherD contracts to a local Anvil chain and write the address manifest the app reads.
# Assumes `anvil` is running on 127.0.0.1:8545 with its default accounts.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
# Anvil default account[0] = deployer, account[1] = executor.
DEPLOYER_PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
EXECUTOR_ADDRESS="${EXECUTOR_ADDRESS:-0x70997970C51812dc3A010C7d01b50e0d17dc79C8}"

OUT=$(DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" EXECUTOR_ADDRESS="$EXECUTOR_ADDRESS" \
  forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast 2>&1)

REG=$(echo "$OUT" | grep "AgentRegistry:" | awk '{print $2}')
NFT=$(echo "$OUT" | grep "AvatarNFT:" | awk '{print $2}')
FAC=$(echo "$OUT" | grep "AgentTokenFactory:" | awk '{print $2}')

if [ -z "$REG" ] || [ -z "$NFT" ] || [ -z "$FAC" ]; then
  echo "$OUT"
  echo "ERROR: deploy did not emit all addresses" >&2
  exit 1
fi

./script/export-abis.sh >/dev/null

cat > out/aetherd-abis/addresses.local.json <<JSON
{
  "chainId": 31337,
  "AgentRegistry": "$REG",
  "AvatarNFT": "$NFT",
  "AgentTokenFactory": "$FAC"
}
JSON

echo "Wrote out/aetherd-abis/addresses.local.json"
cat out/aetherd-abis/addresses.local.json
