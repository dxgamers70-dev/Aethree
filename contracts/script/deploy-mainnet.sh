#!/usr/bin/env bash
# Deploy AeThree contracts to Base MAINNET (chainId 8453) and write the address
# manifest the app reads. Secrets come from the environment (contracts/.env).
#   DEPLOYER_PRIVATE_KEY   (required) funded Base mainnet key
#   AEON_ADDRESS           (required) real AEON ERC-20 on Base mainnet — wired into the factory
#   EXECUTOR_ADDRESS       (optional) keeper that anchors votes; defaults to the deployer
#   TREASURY_ADDRESS       (optional) AEON fee sink; defaults to the deployer
#   RHEGI_PLATFORM_ADDRESS (optional) platform fee recipient; defaults to the deployer
#   BASE_MAINNET_RPC_URL   (optional) defaults to the public endpoint
#   BASESCAN_API_KEY       (optional) when set, contracts are verified on Basescan
set -euo pipefail
cd "$(dirname "$0")/.."

# Load contracts/.env if present (DEPLOYER_PRIVATE_KEY etc.)
if [ -f .env ]; then set -a; . ./.env; set +a; fi

: "${DEPLOYER_PRIVATE_KEY:?set DEPLOYER_PRIVATE_KEY}"
: "${AEON_ADDRESS:=0xBf8E8f0e8866a7052F948C16508644347c57aba3}"
RPC_URL="${BASE_MAINNET_RPC_URL:-https://mainnet.base.org}"
EXECUTOR_ADDRESS="${EXECUTOR_ADDRESS:-$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")}"
DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")

echo "Network:   Base mainnet (8453)"
echo "Deployer:  $DEPLOYER"
echo "Executor:  $EXECUTOR_ADDRESS"
echo "AEON:      $AEON_ADDRESS"
echo "RPC:       $RPC_URL"

# Safety: AEON must have code on-chain (never wire the factory to an empty address).
if [ "$(cast codesize "$AEON_ADDRESS" --rpc-url "$RPC_URL")" = "0" ]; then
  echo "ERROR: AEON_ADDRESS $AEON_ADDRESS has no code on Base mainnet" >&2
  exit 1
fi

VERIFY=""
if [ -n "${BASESCAN_API_KEY:-}" ]; then VERIFY="--verify"; fi

OUT=$(DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" EXECUTOR_ADDRESS="$EXECUTOR_ADDRESS" \
  AEON_ADDRESS="$AEON_ADDRESS" \
  forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --slow $VERIFY 2>&1)
echo "$OUT"

REG=$(echo "$OUT" | grep "AgentRegistry:" | awk '{print $NF}')
NFT=$(echo "$OUT" | grep "AvatarNFT:" | awk '{print $NF}')
FAC=$(echo "$OUT" | grep "AgentTokenFactory:" | awk '{print $NF}')
AEO=$(echo "$OUT" | grep "AEON:" | awk '{print $NF}')

if [ -z "$REG" ] || [ -z "$NFT" ] || [ -z "$FAC" ] || [ -z "$AEO" ]; then
  echo "ERROR: deploy did not emit all addresses" >&2
  exit 1
fi

./script/export-abis.sh >/dev/null

MANIFEST=$(cat <<JSON
{
  "chainId": 8453,
  "AEON": "$AEO",
  "AgentRegistry": "$REG",
  "AvatarNFT": "$NFT",
  "AgentTokenFactory": "$FAC"
}
JSON
)
echo "$MANIFEST" > out/aetherd-abis/addresses.base-mainnet.json
echo "$MANIFEST" > ../web/src/lib/contracts/abis/addresses.base-mainnet.json

echo "Wrote addresses.base-mainnet.json:"
echo "$MANIFEST"
