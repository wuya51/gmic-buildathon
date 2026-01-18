# GMIC Buildathon Project

A decentralized Microchains social messaging application built on Linera GMicrochains.

## 🌟 Project Overview

**GMIC (GM + Microchains)** enables users to send "GMicrochains" messages with social features and real-time updates.

### Key Features
- **Microchains messaging**: Send GMicrochains messages
- **Multi-format support**: Text, GIF, and voice messages
- **User profiles**: Customizable usernames and avatars
- **Social features**: Invitation system and leaderboards
- **Real-time updates**: Live message synchronization
- **Security**: Message validation and cooldown system

## 📋 Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)

## 🏗️ Architecture

### Technology Stack

**Backend**: Rust + Linera SDK with GraphQL API
**Frontend**: React + Vite with Tailwind CSS
**Storage**: On-chain state + IPFS for large files
**State Management**: Linera Views (MapView, RegisterView)
**Logging**: Minimal logging (all logging code removed for production)

### System Components
- **UI Layer**: Message composition, user profiles, leaderboards
- **GraphQL API**: Queries (data retrieval) and mutations (transaction hashes only)
- **Smart Contract**: Message handling and state management with proper Service/Contract separation
- **Storage**: On-chain data + IPFS for media files
- **Permission System**: Whitelist-based admin operations
- **Cooldown System**: 24-hour limit with whitelist bypass

## ✨ Features

### Messaging
- **Multi-format**: Text, GIF, and voice messages
- **Cross-chain**: Send messages across Linera chains
- **Security**: Content validation and XSS protection
- **Cooldown**: 24-hour limit with whitelist bypass
- **Signature Verification**: Secure message signing and validation

### User Profiles
- **Customization**: Usernames and avatar uploads
- **Statistics**: Message counts and activity tracking
- **Leaderboards**: User and chain rankings

### Social Features
- **Invitation System**: Referral rewards and tracking
- **Real-time Updates**: Live message synchronization
- **Message History**: Organized conversation view
- **Admin Controls**: Whitelist management and cooldown toggle
- **Statistics**: Hourly, daily, and monthly message statistics

### Frontend
- **Responsive Design**: Mobile-optimized interface
- **Wallet Integration**: Multi-wallet support
- **Notifications**: Real-time alerts and feedback

## 📁 Project Structure

```
gmic-buildathon/
├── src/                          # Rust smart contract source
│   ├── lib.rs                    # Core types and ABI definitions
│   ├── contract.rs               # Contract implementation
│   ├── service.rs                # GraphQL service
│   └── state.rs                  # State management
├── web-frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── ChatHistory.js    # Message history component
│   │   │   ├── EmojiPicker.js    # Emoji selection
│   │   │   ├── GifPicker.js      # GIF selection
│   │   │   └── UserProfile.js    # User profile management
│   │   ├── pages/                # Page components
│   │   │   ├── Leaderboard.js    # Leaderboard page
│   │   │   ├── NotificationCenter.js # Notification system
│   │   │   └── index.js          # Pages index
│   │   ├── services/             # Service layer
│   │   │   ├── GMOperations.js   # GraphQL operations
│   │   │   ├── wallet/           # Wallet services
│   │   │   │   ├── dynamic-signer.ts
│   │   │   │   ├── linera-adapter.ts
│   │   │   │   └── index.ts
│   │   │   └── index.js          # Services index
│   │   ├── utils/                # Utility functions
│   │   │   ├── queries.js        # GraphQL queries
│   │   │   ├── styles.js         # Style utilities
│   │   │   ├── utils.js          # General utilities
│   │   │   └── index.js          # Utils index
│   │   ├── providers/            # React providers
│   │   │   ├── WalletProvider.js # Wallet integration
│   │   │   ├── GraphQLProvider.js # GraphQL client setup
│   │   │   └── index.js          # Providers index
│   │   ├── hooks/                # Custom React hooks
│   │   │   └── index.js          # Hooks index
│   │   ├── App.js                # Main application component
│   │   ├── App.css               # Application styles
│   │   ├── index.js              # Application entry point
│   │   └── index.css             # Global styles
│   ├── public/                   # Static assets
│   │   ├── GMic.png              # Application logo
│   │   ├── favicon.ico           # Favicon
│   │   └── index.html            # HTML template
│   ├── package.json              # Node dependencies
│   ├── vite.config.js            # Vite configuration
│   └── tailwind.config.js        # Tailwind CSS configuration
├── run.bash                      # Setup and run script
├── compose.yaml                  # Docker Compose (experimental)
├── Dockerfile                    # Docker configuration
├── Cargo.toml                    # Rust dependencies
└── README.md                     # This file
```

## 🚀 Quick Start

### Prerequisites

- **Rust**: Latest stable version
- **Node.js**: v16 or higher
- **npm** or **pnpm**: Package manager
- **Linera SDK**: Installed and configured
- **Pinata Account**: Free account for IPFS storage

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/wuya51/gmic-buildathon
   cd gmic-buildathon
   ```

2. **Make the run script executable**
   ```bash
   chmod +x run.bash
   ```

3. **Run the application**
   ```bash
   ./run.bash
   ```

The script will automatically:
- Set up the Linera wallet
- Request a new chain from the faucet
- Build WASM modules
- Publish the application
- Start the backend service (port 8080)
- Start the frontend (port 3000)

### Access the Application

After running the script, you can access:

- **Frontend**: `http://localhost:3000/[CHAIN_ID]?app=[APP_ID]&owner=[OWNER_ID]&port=8080`
- **GraphQL API**: `http://localhost:8080/chains/[CHAIN_ID]/applications/[APP_ID]`
- **Backend Logs**: `tail -f backend.log`
- **Frontend Logs**: `tail -f frontend.log`

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in `web-frontend/` with the following variables:

```bash
# Linera Configuration
VITE_CHAIN_ID=your_chain_id
VITE_APP_ID=your_app_id
VITE_OWNER_ID=your_owner_id
VITE_WHITELIST_ADDRESS=0xfe609ad118ba733dafb3ce2b6094c86a441b10de4ffd1651251fffe973efd959
VITE_PORT=8080
VITE_HOST=localhost

# Pinata IPFS Configuration
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET_API_KEY=your_pinata_secret_api_key
```

### Pinata Setup

1. **Create Account**: Sign up at [pinata.cloud](https://pinata.cloud)
2. **Generate API Keys**:
   - Go to API Keys section in your dashboard
   - Create new API key with appropriate permissions
   - Copy the API Key and Secret API Key
3. **Configure Environment**: Add keys to your `.env` file

### Cooldown Whitelist

The application includes a hardcoded whitelist address that is automatically added to the cooldown whitelist when the contract owner is set:

**Hardcoded Whitelist Address**: `0xfe609ad118ba733dafb3ce2b6094c86a441b10de4ffd1651251fffe973efd959`

This address is defined in `src/state.rs` and is automatically added to the whitelist along with the contract owner when the application is initialized.

To bypass the 24-hour cooldown for additional addresses, configure the environment variable:

```bash
# In web-frontend/.env file
VITE_WHITELIST_ADDRESS=your_wallet_address_here
```

Replace `your_wallet_address_here` with your wallet address. The address will be automatically configured for both frontend and backend.

**Note**: The `run.bash` script automatically sets this environment variable during deployment.

### Predefined Contacts

The application includes predefined contacts in the contact selector:
- **wuya51**: `0xfe609ad118ba733dafb3ce2b6094c86a441b10de4ffd1651251fffe973efd959`
- **GMIC**: Owner address (configured in `.env`)

These contacts can be customized by modifying the `defaultContacts` object in `web-frontend/src/App.js`.

## 📚 API Reference

### GraphQL Queries

#### Get User Messages
```graphql
query GetGmEvents($sender: AccountOwner!) {
  getGmEvents(sender: $sender) {
    sender
    sender_name
    sender_avatar
    recipient
    recipient_name
    recipient_avatar
    timestamp
    content {
      message_type
      content
    }
  }
}
```

#### Get Total Messages
```graphql
query GetTotalMessages {
  getTotalMessages
}
```

#### Get Leaderboard
```graphql
query GetTopUsers($limit: Int!) {
  getTopUsers(limit: $limit) {
    user
    count
  }
}
```

#### Get User Profile
```graphql
query GetUserProfile($user: AccountOwner!) {
  getUserProfile(user: $user) {
    name
    avatar
  }
}
```

#### Check Cooldown Status
```graphql
query CheckCooldown($user: AccountOwner!) {
  checkCooldownStatus(user: $user) {
    inCooldown
    remainingTime
    enabled
  }
}
```

#### Get Cooldown Status
```graphql
query GetCooldownStatus {
  getCooldownStatus {
    enabled
  }
}
```

#### Check User Whitelist Status
```graphql
query IsUserWhitelisted($user: AccountOwner!) {
  isUserWhitelisted(user: $user)
}
```

### GraphQL Mutations

#### Send GM Message
```graphql
mutation SendGm(
  $sender: AccountOwner!
  $recipient: AccountOwner!
  $content: MessageContentInput!
  $signature: String!
) {
  sendGm(
    sender: $sender
    recipient: $recipient
    content: $content
    signature: $signature
  )
}
```

#### Update User Profile
```graphql
mutation SetUserProfile(
  $user: AccountOwner!
  $profile: UserProfileInput!
) {
  setUserProfile(
    user: $user
    profile: $profile
  )
}
```

#### Set Cooldown Enabled
```graphql
mutation SetCooldownEnabled(
  $caller: AccountOwner!
  $enabled: Boolean!
) {
  setCooldownEnabled(
    caller: $caller
    enabled: $enabled
  )
}
```

#### Add Whitelist Address
```graphql
mutation AddWhitelistAddress(
  $caller: AccountOwner!
  $address: AccountOwner!
) {
  addWhitelistAddress(
    caller: $caller
    address: $address
  )
}
```

#### Remove Whitelist Address
```graphql
mutation RemoveWhitelistAddress(
  $caller: AccountOwner!
  $address: AccountOwner!
) {
  removeWhitelistAddress(
    caller: $caller
    address: $address
  )
}
```

#### Claim Invitation Rewards
```graphql
mutation ClaimRewards($sender: AccountOwner!) {
  claimInvitationRewards(sender: $sender)
}
```

### GraphQL Subscriptions

#### Stream Events
```graphql
subscription StreamEvents($chainId: ChainId!) {
  streamEvents(chainId: $chainId) {
    sender
    recipient
    timestamp
    content {
      message_type
      content
    }
  }
}
```

## 🛠️ Development Guide

### Modifying the Smart Contract

1. **Edit Rust Source**: Modify files in `src/` directory
2. **Build WASM**:
   ```bash
   cargo build --release --target wasm32-unknown-unknown
   ```
3. **Publish Changes**:
   ```bash
   linera publish-module examples/target/wasm32-unknown-unknown/release/gm_{contract,service}.wasm
   ```

### Modifying the Frontend

1. **Edit React Components**: Modify files in `web-frontend/src/`
2. **Hot Reload**: Vite provides hot module replacement during development
3. **Build for Production**:
   ```bash
   cd web-frontend
   npm run build
   ```

### Adding New Features

**Example: Adding a new message type**

1. **Update `src/lib.rs`**:
   ```rust
   impl MessageContent {
       pub fn is_new_type(&self) -> bool {
           self.message_type == "new_type"
       }
   }
   ```

2. **Update `src/contract.rs`**:
   ```rust
   impl GmContract {
       pub fn is_message_content_valid(content: &MessageContent) -> bool {
           // Add validation for new type
       }
   }
   ```

3. **Update Frontend**:
   - Add UI component in `web-frontend/src/components/`
   - Integrate with `App.js`
   - Update GraphQL operations in `GMOperations.js`

### Testing

**Run Frontend Tests**:
```bash
cd web-frontend
npm test
```

**Run Rust Tests**:
```bash
cargo test
```

## 🔧 Troubleshooting

### Common Issues

#### Wallet Connection Problems

**Issue**: Wallet won't connect
- **Solution**: 
  - Check if wallet is installed and unlocked
  - Verify network settings match Linera testnet
  - Clear browser cache and try again
  - Check console for specific error messages

**Issue**: "Invalid account owner" error
- **Solution**:
  - Ensure wallet address is in correct format (0x prefix)
  - Verify address length (should be 42 characters)
  - Check if address is properly formatted in `.env` file

#### Message Sending Issues

**Issue**: Messages not sending
- **Solution**:
  - Check if you're in cooldown period
  - Verify recipient address is valid
  - Ensure you have sufficient gas
  - Check network connectivity
  - Review backend logs for errors

**Issue**: Voice messages not uploading
- **Solution**:
  - Verify Pinata API keys are correct
  - Check microphone permissions in browser
  - Ensure internet connection is stable
  - Verify file size is within limits
  - Check Pinata service status

#### IPFS Issues

**Issue**: Avatar upload fails
- **Solution**:
  - Verify Pinata credentials in `.env`
  - Check image file size (should be < 10MB)
  - Ensure file format is supported (PNG, JPG, GIF)
  - Verify internet connection
  - Check Pinata dashboard for upload limits

**Issue**: IPFS links not loading
- **Solution**:
  - Verify IPFS gateway is accessible
  - Check if content is properly pinned
  - Try alternative IPFS gateways
  - Clear browser cache

#### Cooldown Issues

**Issue**: Cooldown not working as expected
- **Solution**:
  - Verify cooldown is enabled using `GET_COOLDOWN_STATUS` query
  - Check if address is whitelisted using `IS_USER_WHITELISTED` query
  - Verify system time is correct
  - Check cooldown duration setting (24 hours)

**Issue**: Want to bypass cooldown
- **Solution**:
  - Use `ADD_WHITELIST_ADDRESS` mutation to add address to whitelist
  - Must be called by contract owner
  - Or disable cooldown system using `SET_COOLDOWN_ENABLED` mutation

### Debug Mode

**Note**: All logging code has been removed from the application for production use. For debugging:

- Check browser console for frontend errors
- Monitor network requests in browser developer tools
- Use GraphQL queries to verify state changes
- Check transaction hashes for on-chain confirmation

### Log Files

- **Backend Logs**: `backend.log` - Linera service logs
- **Frontend Logs**: `frontend.log` - Vite development server logs

View logs in real-time:
```bash
tail -f backend.log
tail -f frontend.log
```

## 🔬 Technical Details

### Smart Contract Architecture

#### State Management

The contract uses Linera's View system for efficient state management with proper Service/Contract separation:

- **Service Layer**: GraphQL API, permission validation, operation scheduling
- **Contract Layer**: State modification, persistence, and event emission

**MapView**: Key-value storage for indexed data
  - `last_gm`: Last GM timestamp per user (chain-specific)
  - `events`: All GM events
  - `user_events`: User-specific events
  - `received_events`: Events received by user
  - `user_profiles`: User profile data
  - `invitations`: Invitation records
  - `invitation_stats`: Invitation statistics
  - `cooldown_whitelist`: Cooldown bypass addresses
  - `hourly_stats`: Hourly message statistics
  - `daily_stats`: Daily message statistics
  - `monthly_stats`: Monthly message statistics

**RegisterView**: Single-value storage
  - `owner`: Application owner
  - `total_messages`: Global message count
  - `cooldown_enabled`: Cooldown system toggle

#### Message Flow

1. **User Action**: User sends message from frontend
2. **Validation**: Frontend validates message content and cooldown status
3. **Signature**: User signs message with wallet
4. **Mutation**: GraphQL mutation sends to contract (returns transaction hash)
5. **Service**: Service validates permissions and schedules operation
6. **Contract**: Contract executes `GmOperation` and updates state
7. **Persistence**: Contract saves state changes to storage
8. **Event Emission**: Contract emits event to stream
9. **Query Verification**: Frontend uses queries to verify state changes
10. **UI Update**: Frontend updates message list and status

#### Security Measures

- **XSS Prevention**: Filter script tags and dangerous HTML
- **Content Validation**: Check message length and format
- **Sensitive Word Filter**: Block inappropriate content
- **URL Validation**: Ensure HTTPS for external links
- **Self-Messaging Block**: Prevent sending to self
- **Cooldown System**: 24-hour rate limiting for message sending
- **Permission System**: Whitelist-based admin operations
- **Signature Verification**: Secure message signing and validation
- **State Persistence**: Proper state saving after modifications
- **Error Handling**: Consistent mutation response format (transaction hashes only)

### Frontend Architecture

#### Component Structure

```
App (Root)
├── ErrorBoundary
├── WalletProvider
│   └── DynamicConnectButton
├── GraphQLProvider
│   └── ApolloClient
├── NotificationCenter
├── GMOperations
│   ├── MessageComposer
│   ├── ContactSelector
│   └── MessageList
├── Leaderboard
├── UserProfile
│   ├── ProfileEditor
│   └── AvatarUploader
└── ChatHistory
    ├── SentMessages
    └── ReceivedMessages
```

#### State Management

The application uses React Hooks for state management:

- **useState**: Component-level state
- **useEffect**: Side effects and subscriptions
- **useCallback**: Memoized callbacks
- **useMemo**: Computed values
- **useRef**: Persistent references

#### Data Flow

1. **User Input**: User interacts with UI components
2. **State Update**: Component state updates
3. **GraphQL Query**: Fetch data from backend
4. **Data Processing**: Process and format data
5. **Render**: Update UI with new data
6. **Subscription**: Listen for real-time updates

#### Performance Optimizations

- **Memoization**: Use `useMemo` and `useCallback` to prevent unnecessary re-renders
- **Lazy Loading**: Load components on demand
- **Debouncing**: Debounce search and input operations
- **Virtual Scrolling**: For large message lists (future enhancement)
- **Caching**: Cache user profiles and frequently accessed data

### IPFS Integration

#### Pinata Configuration

The application uses Pinata Cloud for IPFS storage:

- **API Authentication**: API key and secret key
- **File Upload**: POST to Pinata API
- **IPFS Gateway**: Use Pinata's public gateway
- **Content Addressing**: IPFS hash for content identification

#### File Storage

- **Voice Messages**: Audio files uploaded to IPFS
- **User Avatars**: Profile images stored on IPFS
- **GIFs**: GIF URLs stored directly (not uploaded)

#### Benefits of IPFS

- **Decentralization**: No single point of failure
- **Content Addressing**: Immutable content addressing
- **Censorship Resistance**: Resistant to censorship
- **Cost-Effective**: Lower storage costs than traditional cloud

### GraphQL Schema

#### Query Types

```graphql
type Query {
  getGmRecord(owner: AccountOwner!): GmRecord
  getGmEvents(sender: AccountOwner!): [GmEvent!]
  getStreamEvents(chainId: ChainId!): [GmEvent!]
  getReceivedGmEvents(recipient: AccountOwner!): [GmEvent!]
  getTotalMessages: Int!
  getChainMessages(chainId: ChainId!): Int!
  getWalletMessages(owner: AccountOwner!): Int!
  getHourlyStats(chainId: ChainId!, startHour: Int!, endHour: Int!): [TimeStat!]
  getDailyStats(chainId: ChainId!, startDay: Int!, endDay: Int!): [TimeStat!]
  getMonthlyStats(chainId: ChainId!, startMonth: Int!, endMonth: Int!): [TimeStat!]
  getTopUsers(limit: Int!): [LeaderboardUser!]
  getTopChains(limit: Int!): [LeaderboardChain!]
  getUserRank(user: AccountOwner!): Int!
  getMessageTrend(chainId: ChainId!, periodDays: Int!): [TimeStat!]
  getUserActivityTrend(user: AccountOwner!, periodDays: Int!): [TimeStat!]
  getNextNonce(owner: AccountOwner!): Int!
  getCooldownStatus: CooldownStatus!
  isUserWhitelisted(user: AccountOwner!): Boolean!
  checkCooldownStatus(user: AccountOwner!): CooldownCheckResult!
  generateSignatureMessage(
    sender: AccountOwner!
    recipient: AccountOwner
    chainId: ChainId!
    content: MessageContent!
  ): String!
  verifyGmSignature(
    signatureData: SignatureData!
    signature: String!
  ): SignatureVerificationResult!
  getInvitationStats(user: AccountOwner!): InvitationStats
  getInvitationRecord(inviter: AccountOwner!): [InvitationRecord!]
  getTopInvitationRewards(limit: Int!): [LeaderboardInvitationUser!]
  getInvitationRank(user: AccountOwner!): Int!
  getUserProfile(user: AccountOwner!): UserProfile!
}
```

#### Mutation Types

```graphql
type Mutation {
  sendGm(
    sender: AccountOwner!
    recipient: AccountOwner!
    content: MessageContent!
    signature: String!
  ): SendGmResponse!
  claimInvitationRewards(sender: AccountOwner!): String!
  setCooldownEnabled(enabled: Boolean!): Boolean!
  setUserProfile(
    user: AccountOwner!
    name: String
    avatar: String
  ): SetUserProfileResult!
}
```

#### Subscription Types

```graphql
type Subscription {
  streamEvents(chainId: ChainId!): GmEvent!
}
```

## 📄 License

This project is part of the Linera Buildathon submission. Please refer to the Linera project license for usage terms.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues, questions, or suggestions:
- Check the troubleshooting section above
- Review the Linera documentation
- Open an issue on the repository

## 🎯 Future Enhancements

Potential improvements for future versions:

- [ ] Group messaging
- [ ] Message encryption
- [ ] Advanced search and filtering
- [ ] Message reactions and replies
- [ ] File sharing support
- [ ] Video messages
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Social media integration
- [ ] NFT integration for avatars
- [ ] Token rewards for activity
- [ ] Advanced moderation tools

---

**Built with ❤️ for the Linera Buildathon**
