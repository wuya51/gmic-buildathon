import { gql } from '@apollo/client';

export const GET_GM_STATS = gql`
  query GetGmStats($chainId: ChainId!) {
    totalMessages: getTotalMessages
    chainMessages: getChainMessages(chainId: $chainId)
  }
`;

export const GET_WALLET_MESSAGES = gql`
  query GetWalletMessages($owner: AccountOwner!) {
    walletMessages: getWalletMessages(owner: $owner)
  }
`;

export const GET_GM_RECORD = gql`
  query GetGmRecord($owner: AccountOwner!) {
    getGmRecord(owner: $owner) {
      owner
      timestamp
    }
  }
`;

export const GET_LEADERBOARD = gql`
  query GetLeaderboard($limit: Int) {
    getTopUsers(limit: $limit) {
      user
      count
    }
  }
`;

export const GET_INVITATION_STATS = gql`
  query GetInvitationStats($user: AccountOwner!) {
    getInvitationStats(user: $user) {
      totalInvited
      totalRewards
      lastRewardTime
    }
  }
`;

export const GET_INVITATION_LEADERBOARD = gql`
  query GetInvitationLeaderboard($limit: Int) {
    getTopInvitors(limit: $limit) {
      user
      count
    }
  }
`;

export const GET_INVITATION_RANK = gql`
  query GetInvitationRank($user: AccountOwner!) {
    getInvitationRank(user: $user)
  }
`;

export const GET_INVITATION_RECORD = gql`
  query GetInvitationRecord($inviter: AccountOwner!) {
    getInvitationRecord(inviter: $inviter) {
      inviter
      invitee
      invitedAt
      rewarded
      rewardedAt
    }
  }
`;

export const CHECK_COOLDOWN = gql`
  query CheckCooldown($user: AccountOwner!) {
    checkCooldownStatus(user: $user) {
      inCooldown
      remainingTime
      enabled
    }
  }
`;

export const IS_USER_WHITELISTED = gql`
  query IsUserWhitelisted($user: AccountOwner!) {
    isUserWhitelisted(user: $user)
  }
`;

export const GET_COOLDOWN_STATUS = gql`
  query GetCooldownStatus {
    getCooldownStatus {
      enabled
    }
  }
`;

export const GET_GM_EVENTS = gql`
  query GetGmEvents($sender: AccountOwner!) {
    getGmEvents(sender: $sender) {
      sender
      senderName
      senderAvatar
      recipient
      recipientName
      recipientAvatar
      timestamp
      content {
        content
        messageType
      }
    }
  }
`;

export const GET_STREAM_EVENTS = gql`
  query GetStreamEvents($chainId: ChainId!) {
    getStreamEvents(chainId: $chainId) {
      sender
      senderName
      senderAvatar
      recipient
      recipientName
      recipientAvatar
      timestamp
      content {
        content
        messageType
      }
    }
  }
`;

export const GET_RECEIVED_GM_EVENTS = gql`
  query GetReceivedGmEvents($recipient: AccountOwner!) {
    getReceivedGmEvents(recipient: $recipient) {
      sender
      senderName
      senderAvatar
      recipient
      recipientName
      recipientAvatar
      timestamp
      content {
        content
        messageType
      }
    }
  }
`;

export const SUBSCRIBE_GM_EVENTS = gql`
  subscription SubscribeGmEvents($chainId: ChainId!) {
    notifications(chainId: $chainId)
  }
`;

export const SEND_GM = gql`
  mutation SendGm($chainId: ChainId!, $sender: AccountOwner!, $recipient: AccountOwner, $messageType: String!, $content: String, $inviter: AccountOwner) {
    sendGm(chainId: $chainId, sender: $sender, recipient: $recipient, content: { messageType: $messageType, content: $content }, inviter: $inviter)
  }
`;

export const SET_COOLDOWN_ENABLED = gql`
  mutation SetCooldownEnabled($caller: AccountOwner!, $enabled: Boolean!) {
    setCooldownEnabled(caller: $caller, enabled: $enabled)
  }
`;

export const SET_USER_PROFILE = gql`
  mutation SetUserProfile($user: AccountOwner!, $profile: UserProfileInput!) {
    setUserProfile(user: $user, profile: $profile)
  }
`;

export const SEND_GM_WITH_SIGNATURE = gql`
  mutation SendGmWithSignature($chainId: ChainId!, $sender: AccountOwner!, $recipient: AccountOwner, $signature: String!, $nonce: Int!, $messageType: String!, $content: String, $inviter: AccountOwner) {
    sendGmWithSignature(chainId: $chainId, sender: $sender, recipient: $recipient, signature: $signature, nonce: $nonce, content: { messageType: $messageType, content: $content }, inviter: $inviter)
  }
`;

export const ADD_WHITELIST_ADDRESS = gql`
  mutation AddWhitelistAddress($caller: AccountOwner!, $address: AccountOwner!) {
    addWhitelistAddress(caller: $caller, address: $address)
  }
`;

export const REMOVE_WHITELIST_ADDRESS = gql`
  mutation RemoveWhitelistAddress($caller: AccountOwner!, $address: AccountOwner!) {
    removeWhitelistAddress(caller: $caller, address: $address)
  }
`;

export const GET_USER_PROFILE = gql`
  query GetUserProfile($user: AccountOwner!) {
    getUserProfile(user: $user) {
      name
      avatar
    }
  }
`;

export const GENERATE_SIGNATURE_MESSAGE = gql`
  query GenerateSignatureMessage($sender: AccountOwner!, $recipient: AccountOwner, $chainId: ChainId!, $timestamp: BigInt!, $nonce: BigInt!, $content: String) {
    generateSignatureMessage(sender: $sender, recipient: $recipient, chainId: $chainId, timestamp: $timestamp, nonce: $nonce, content: $content)
  }
`;

export const VERIFY_GM_SIGNATURE = gql`
  query VerifyGmSignature($signatureData: SignatureDataInput!) {
    verifyGmSignature(signatureData: $signatureData) {
      success
      message
      verifiedSender
    }
  }
`;

export const GET_TOP_CHAINS = gql`
  query GetTopChains($limit: Int) {
    getTopChains(limit: $limit) {
      chainId
      count
    }
  }
`;

export const GET_USER_RANK = gql`
  query GetUserRank($user: AccountOwner!) {
    getUserRank(user: $user)
  }
`;

export const GET_MESSAGE_TREND = gql`
  query GetMessageTrend($chainId: ChainId!, $periodDays: Int!) {
    getMessageTrend(chainId: $chainId, periodDays: $periodDays) {
      timestamp
      count
    }
  }
`;

export const GET_USER_ACTIVITY_TREND = gql`
  query GetUserActivityTrend($user: AccountOwner!, $periodDays: Int!) {
    getUserActivityTrend(user: $user, periodDays: $periodDays) {
      timestamp
      count
    }
  }
`;

export const GET_NEXT_NONCE = gql`
  query GetNextNonce($owner: AccountOwner!) {
    getNextNonce(owner: $owner)
  }
`;

export const GET_HOURLY_STATS = gql`
  query GetHourlyStats($chainId: ChainId!, $startHour: BigInt!, $endHour: BigInt!) {
    getHourlyStats(chainId: $chainId, startHour: $startHour, endHour: $endHour) {
      timestamp
      count
    }
  }
`;

export const GET_DAILY_STATS = gql`
  query GetDailyStats($chainId: ChainId!, $startDay: BigInt!, $endDay: BigInt!) {
    getDailyStats(chainId: $chainId, startDay: $startDay, endDay: $endDay) {
      timestamp
      count
    }
  }
`;

export const GET_MONTHLY_STATS = gql`
  query GetMonthlyStats($chainId: ChainId!, $startMonth: BigInt!, $endMonth: BigInt!) {
    getMonthlyStats(chainId: $chainId, startMonth: $startMonth, endMonth: $endMonth) {
      timestamp
      count
    }
  }
`;

export const GET_TOP_INVITATION_REWARDS = gql`
  query GetTopInvitationRewards($limit: Int) {
    getTopInvitationRewards(limit: $limit) {
      user
      rewards
    }
  }
`;
