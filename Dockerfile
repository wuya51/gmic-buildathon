FROM rust:1.86-slim

SHELL ["bash", "-c"]

RUN apt-get update && apt-get install -y \
    pkg-config \
    protobuf-compiler \
    clang \
    make \
    curl

# Install Node.js environment
RUN curl https://raw.githubusercontent.com/creationix/nvm/v0.40.3/install.sh | bash \
    && . ~/.nvm/nvm.sh \
    && nvm install lts/krypton \
    && npm install -g pnpm

# Add WASM target
RUN rustup target add wasm32-unknown-unknown

# Set working directory to linera-protocol root
WORKDIR /linera-protocol

# Copy entire linera-protocol project (including workspace configuration)
COPY . .

# Install linera toolchain (from crates.io)
RUN cargo install --locked linera-service@0.15.8
RUN cargo install --locked linera-storage-service@0.15.8

# Switch to application directory
WORKDIR /linera-protocol/examples/gmic-buildathon

HEALTHCHECK CMD ["curl", "-s", "http://localhost:5173"]

ENTRYPOINT bash /linera-protocol/examples/gmic-buildathon/run.bash