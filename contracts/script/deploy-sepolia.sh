#!/usr/bin/env bash
# Deploy AeThree contracts to Base Sepolia and write the address manifest the app reads.
# Secrets come from the environment — nothing is hardcoded here.
#   DEPLOYER_PRIVATE_KEY   (required) funded Base Sepolia key
#   EXECUTOR_ADDRESS       (optional) keeper that anchors votes; defaults to the deployer
#   BASE_SEPOLIA_RPC_URL   (optional) defaults to the public endpoint
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DEPLOYER_PRIVATE_KEY:?set DEPLOYER_PRIVATE_KEY}"
RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
EXECUTOR_ADDRESS="${EXECUTOR_ADDRESS:-$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")}"

echo "Deployer:  $(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
echo "Executor:  $EXECUTOR_ADDRESS"
echo "RPC:       $RPC_URL"

OUT=$(DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" EXECUTOR_ADDRESS="$EXECUTOR_ADDRESS" \
  forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --slow 2>&1)

REG=$(echo "$OUT" | grep "AgentRegistry:" | awk '{print $NF}')
NFT=$(echo "$OUT" | grep "AvatarNFT:" | awk '{print $NF}')
FAC=$(echo "$OUT" | grep "AgentTokenFactory:" | awk '{print $NF}')
AEO=$(echo "$OUT" | grep "AEON:" | awk '{print $NF}')

if [ -z "$REG" ] || [ -z "$NFT" ] || [ -z "$FAC" ] || [ -z "$AEO" ]; then
  echo "$OUT"
  echo "ERROR: deploy did not emit all addresses" >&2
  exit 1
fi

./script/export-abis.sh >/dev/null

MANIFEST=$(cat <<JSON
{
  "chainId": 84532,
  "AEON": "$AEO",
  "AgentRegistry": "$REG",
  "AvatarNFT": "$NFT",
  "AgentTokenFactory": "$FAC"
}
JSON
)
echo "$MANIFEST" > out/aetherd-abis/addresses.base-sepolia.json
echo "$MANIFEST" > ../web/src/lib/contracts/abis/addresses.base-sepolia.json

echo "Wrote addresses.base-sepolia.json:"
echo "$MANIFEST"
