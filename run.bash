#!/usr/bin/env bash

set -eu

# Get script directory and linera-protocol directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Script directory: $SCRIPT_DIR"
LINERA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
echo "Linera protocol directory: $LINERA_DIR"

# Get application name (current directory name)
APP_NAME=$(basename "$SCRIPT_DIR")
echo "Application name: $APP_NAME"

# Check and add application to examples/Cargo.toml workspace
EXAMPLES_CARGO_TOML="$LINERA_DIR/examples/Cargo.toml"
if [ -f "$EXAMPLES_CARGO_TOML" ]; then
    # Check if application is already in workspace members list
    if ! grep -q "\"$APP_NAME\"" "$EXAMPLES_CARGO_TOML"; then
        echo "Adding application $APP_NAME to workspace members list..."
        # Add application name to members list, after the last entry
        sed -i '/^members = \[/,/^]$/ s/^]$/    "'"$APP_NAME"'",\n]/' "$EXAMPLES_CARGO_TOML"
        echo "Added $APP_NAME to workspace members list"
        
        # Check if application is already in workspace.dependencies
        if ! grep -q "gm = { path" "$EXAMPLES_CARGO_TOML"; then
            # Add application dependency to workspace.dependencies section
            echo "Adding gm to workspace dependencies..."
            # Find the last workspace dependency and add after it
            LAST_DEP=$(grep -n "= { path = \"\.\/" "$EXAMPLES_CARGO_TOML" | tail -1 | cut -d: -f1)
            if [ -n "$LAST_DEP" ]; then
                sed -i "${LAST_DEP}a gm = { path = \"./${APP_NAME}\" }" "$EXAMPLES_CARGO_TOML"
            else
                # If no other dependencies found, add after [workspace.dependencies]
                sed -i '/^\[workspace.dependencies\]/a gm = { path = "./'"$APP_NAME"'" }' "$EXAMPLES_CARGO_TOML"
            fi
            echo "Added gm to workspace dependencies"
        else
            echo "Application gm is already in workspace dependencies, skipping"
        fi
    else
        echo "Application $APP_NAME is already in workspace members list"
    fi
else
    echo "Warning: examples/Cargo.toml file not found"
fi

# Set up directories and environment variables
DIR=$HOME/.config
mkdir -p $DIR
export LINERA_WALLET="$DIR/wallet.json"
export LINERA_KEYSTORE="$DIR/keystore.json"
export LINERA_STORAGE="rocksdb:$DIR/wallet.db"

# Switch to linera-protocol directory to execute Linera commands
cd "$LINERA_DIR"

# Check if wallet exists, initialize if it doesn't
if [ ! -f "$LINERA_WALLET" ]; then
    echo "Wallet does not exist, initializing..."
    linera wallet init --faucet https://faucet.testnet-conway.linera.net
else
    echo "Wallet already exists, skipping initialization"
fi

# Request a new chain and capture output (CHAIN and OWNER)
CHAIN_OWNER=($(linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net))
CHAIN="${CHAIN_OWNER[0]}"
OWNER="${CHAIN_OWNER[1]}"

# Verification (optional): Display chain information in wallet
linera wallet show

# Switch back to gmic-buildathon directory to build WASM modules
cd "$SCRIPT_DIR"
# Use standalone Cargo command to build, avoiding workspace conflicts
CARGO_MANIFEST_DIR="$SCRIPT_DIR" cargo build --release --target wasm32-unknown-unknown --manifest-path "$SCRIPT_DIR/Cargo.toml"

# Switch back to linera-protocol directory to publish modules
cd "$LINERA_DIR"
echo "Current directory: $(pwd)"
echo "Publishing modules..."
MODULE_ID=$(linera publish-module \
    examples/target/wasm32-unknown-unknown/release/gm_{contract,service}.wasm)

# Create application on specified chain
APP_ID=$(linera create-application "$MODULE_ID" "$CHAIN")

# Save CHAIN_ID and APP_ID to .env file for frontend use
ENV_FILE="$SCRIPT_DIR/web-frontend/.env"
echo "VITE_CHAIN_ID=$CHAIN" > "$ENV_FILE"
echo "VITE_APP_ID=$APP_ID" >> "$ENV_FILE"
echo "VITE_OWNER_ID=$OWNER" >> "$ENV_FILE"
echo "VITE_WHITELIST_ADDRESS=0xfe609ad118ba733dafb3ce2b6094c86a441b10de4ffd1651251fffe973efd959" >> "$ENV_FILE"
echo "VITE_PORT=8080" >> "$ENV_FILE"
echo "VITE_HOST=localhost" >> "$ENV_FILE"
echo "Environment variables saved to: $ENV_FILE"

# Start Linera service
echo "Starting Linera service on port 8080..."
# Set log level for detailed debugging
export RUST_LOG=info
echo "RUST_LOG environment variable set to: $RUST_LOG"
# Save backend logs to file
linera service --port 8080 > "$SCRIPT_DIR/backend.log" 2>&1 &
SERVICE_PID=$!
echo "Linera service started, PID: $SERVICE_PID"
echo "Backend logs saved to: $SCRIPT_DIR/backend.log"
echo "Log level: $RUST_LOG"

# Build and run frontend
cd "$SCRIPT_DIR/web-frontend"
npm install
# Save frontend logs to file
BROWSER=none npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend service started, PID: $FRONTEND_PID"
echo "Frontend logs saved to: $SCRIPT_DIR/frontend.log"

# Wait for services to start up
sleep 5

# Output access paths
echo "======================================"
echo "Services started, access URLs:"
echo "Frontend URL: http://localhost:3000/$CHAIN?app=$APP_ID&owner=$OWNER&port=8080"
echo "GraphQL URL: http://localhost:8080/chains/$CHAIN/applications/$APP_ID"
echo ""
echo "Log viewing commands:"
echo "Frontend logs: tail -f $SCRIPT_DIR/frontend.log"
echo "Backend logs: tail -f $SCRIPT_DIR/backend.log"
echo "======================================"

# Wait for user interrupt
echo "Press Ctrl+C to stop all services"
trap "echo 'Stopping services...'; kill $SERVICE_PID $FRONTEND_PID; exit" INT
wait
