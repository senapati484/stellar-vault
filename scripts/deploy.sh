#!/bin/bash
set -e

echo "=== StellarVault Deployment Script ==="
echo ""

echo "1/7 Checking stellar CLI..."
if ! command -v stellar &> /dev/null; then
    echo "Error: stellar CLI not installed"
    echo "Install with: npm install -g @stellar/js-stellar-sdk"
    exit 1
fi
echo "✓ stellar CLI found"

echo ""
echo "2/7 Generating/reusing deployer key..."
stellar keys generate --global deployer --network testnet 2>/dev/null || true
DEPLOYER_ADDR=$(stellar keys address deployer)
echo "Deployer: $DEPLOYER_ADDR"

echo ""
echo "3/7 Funding deployer via Friendbot..."
FUND_RESPONSE=$(curl -s "https://friendbot.stellar.org?addr=$DEPLOYER_ADDR")
if echo "$FUND_RESPONSE" | grep -q "hash"; then
    echo "✓ Funded via Friendbot"
else
    echo "Note: May already be funded or response: $FUND_RESPONSE"
fi

echo ""
echo "4/7 Building contract..."
cargo build --target wasm32-unknown-unknown --release \
    --manifest-path contracts/stellar_vault/Cargo.toml
echo "✓ Built stellar_vault.wasm"

echo ""
echo "5/7 Deploying contract to testnet..."
CONTRACT_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/stellar_vault.wasm \
    --source deployer --network testnet)
echo "Contract ID: $CONTRACT_ID"

echo ""
echo "6/7 Seeding sample entries..."

echo "   a) deposit: 5000000 (Initial deposit)"
TX1=$(stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source deployer \
    --network testnet \
    record_entry \
    --owner "$DEPLOYER_ADDR" \
    --action "deposit" \
    --amount 5000000 \
    --memo "Initial deposit" \
    2>/dev/null | grep -o '"hash":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
echo "   TX1: $TX1"

echo "   b) withdraw: 1000000 (Coffee)"
TX2=$(stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source deployer \
    --network testnet \
    record_entry \
    --owner "$DEPLOYER_ADDR" \
    --action "withdraw" \
    --amount 1000000 \
    --memo "Coffee" \
    2>/dev/null | grep -o '"hash":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
echo "   TX2: $TX2"

echo "   c) deposit: 2500000 (Freelance payment)"
TX3=$(stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source deployer \
    --network testnet \
    record_entry \
    --owner "$DEPLOYER_ADDR" \
    --action "deposit" \
    --amount 2500000 \
    --memo "Freelance payment" \
    2>/dev/null | grep -o '"hash":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
echo "   TX3: $TX3"

echo ""
echo "7/7 Writing .env.local..."
echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID" > .env.local
echo "NEXT_PUBLIC_DEPLOYER=$DEPLOYER_ADDR" >> .env.local
echo "NEXT_PUBLIC_NETWORK=testnet" >> .env.local
echo "✓ Written to .env.local"

echo ""
echo "=== Deployment Complete ==="
echo "✓ Contract:  $CONTRACT_ID"
echo "✓ Explorer:  https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo "✓ Seed TX1:  $TX1"
echo "✓ Seed TX2:  $TX2"
echo "✓ Seed TX3:  $TX3"
echo ""
echo "To run tests:"
echo "  cargo test --manifest-path contracts/stellar_vault/Cargo.toml"