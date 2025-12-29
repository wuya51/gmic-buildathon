import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useSubscription, useLazyQuery } from '@apollo/client';
import { useWallet } from '../providers';
import {
  GET_GM_STATS, 
  GET_WALLET_MESSAGES, 
  GET_GM_RECORD, 
  GET_LEADERBOARD, 
  CHECK_COOLDOWN, 
  GET_COOLDOWN_STATUS, 
  GET_GM_EVENTS, 
  GET_STREAM_EVENTS,
  IS_USER_WHITELISTED,
  GET_INVITATION_LEADERBOARD,
  GET_INVITATION_STATS,
  GET_INVITATION_RECORD,
  SEND_GM, 
  SET_COOLDOWN_ENABLED,
  SUBSCRIBE_GM_EVENTS,
  GET_RECEIVED_GM_EVENTS,
  SET_USER_PROFILE,
  GET_USER_PROFILE
} from '../utils/queries';

const isValidAccountOwner = (owner) => {
  if (!owner) return false;
  const cleanAddress = owner.trim();
    
  if (/^0x[a-fA-F0-9]{40}$/.test(cleanAddress) || /^0x[a-fA-F0-9]{64}$/.test(cleanAddress)) {
    return true;
  }
  if (/^[a-fA-F0-9]{40}$/.test(cleanAddress) || /^[a-fA-F0-9]{64}$/.test(cleanAddress)) {
    return true;
  }
  return false;
};

const isValidChainId = (chainId) => {
  if (!chainId) return false;
  return /^[0-9a-fA-F]{64}$/.test(chainId);
};

const isLineraChainId = (chainId) => {
  if (!chainId) return false;
  return /^[0-9a-fA-F]{64}$/.test(chainId);
};

const getQueryChainId = (currentChainId, contractChainId) => {
  return isLineraChainId(currentChainId) ? currentChainId : contractChainId;
};

const formatAccountOwner = (address) => {
  if (!address) return '';
  const cleanAddress = address.trim();
  if (cleanAddress.startsWith('0x')) {
    return cleanAddress.toLowerCase();
  }
  return `0x${cleanAddress.toLowerCase()}`;
};

const formatCooldown = (remainingMs, returnObject = false) => {
  if (!remainingMs || remainingMs <= 0) {
    return returnObject ? { hours: 0, minutes: 0, seconds: 0 } : "Ready";
  }
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
  
  if (returnObject) {
    return { hours, minutes, seconds };
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

const GMOperations = ({
  chainId,
  currentAccount,
  currentChainId,
  walletMode,
  queryRetryCount,
  setQueryRetryCount,
  setOperationStatus,
  setClaimStatus,
  setMessage,
  targetChainId,
  recipientAddress,
  onMutationComplete,
  onMutationError,
  customMessage,
  customMessageEnabled,
  cooldownStatus,
  inviter,
  currentIsConnected,
  currentChatPartner
}) => {
  const queryChainId = getQueryChainId(currentChainId, chainId);
  const [subscriptionData, setSubscriptionData] = useState({
    gmEvents: []
  });

  const [subscriptionStatus, setSubscriptionStatus] = useState({
    gmEvents: { active: false, lastUpdate: null, error: null }
  });

  const [subscriptionConnectionStatus, setSubscriptionConnectionStatus] = useState({
    connected: false,
    lastConnectionCheck: null,
    retryCount: 0
  });

  const [processedEventIds, setProcessedEventIds] = useState(new Set());
  const [lastProcessedTime, setLastProcessedTime] = useState(0);
  
  const [pageLoadTime, setPageLoadTime] = useState(0);

  useEffect(() => {
    if (pageLoadTime === 0) {
      setPageLoadTime(Date.now());
    }
  }, []);

  useEffect(() => {
    if (!chainId) return;

    const checkSubscriptionStatus = () => {
      const now = new Date().toISOString();
      
      const isActive = !subscriptionStatus.gmEvents.error && 
                      subscriptionStatus.gmEvents.lastUpdate && 
                      (Date.now() - new Date(subscriptionStatus.gmEvents.lastUpdate).getTime()) < 60000;
      
      setSubscriptionConnectionStatus(prev => {
        const newRetryCount = isActive ? 0 : prev.retryCount + 1;
        
        if (!isActive && newRetryCount < 3) {
        }
        
        return {
          connected: isActive,
          lastConnectionCheck: now,
          retryCount: newRetryCount
        };
      });
    };

    const intervalId = setInterval(checkSubscriptionStatus, 10000);
    
    checkSubscriptionStatus();

    return () => clearInterval(intervalId);
  }, [chainId, subscriptionStatus.gmEvents.error, subscriptionStatus.gmEvents.lastUpdate]);

  const { data: gmEventsSubscriptionData, loading: gmEventsLoading, error: gmEventsError } = useSubscription(SUBSCRIBE_GM_EVENTS, {
    variables: { chainId: queryChainId },
    skip: !isValidChainId(queryChainId),
    shouldResubscribe: false,
    onData: ({ data }) => {
      
      if (data) {
        setSubscriptionStatus(prev => ({
          ...prev,
          gmEvents: {
            active: true,
            lastUpdate: new Date().toISOString(),
            error: null
          }
        }));
        
        try {
          const notificationData = data?.data?.notifications || data?.notifications;
          
          if (!notificationData) {
            return;
          }
          
          const blockInfo = notificationData?.reason?.NewBlock;
          const blockHeight = blockInfo?.height;
          const blockHash = blockInfo?.hash;
          
          if (!blockHeight || !blockHash) {
            return;
          }
          
          const eventId = `block-${blockHeight}-${blockHash.substring(0, 16)}`;
          
          if (processedEventIds.has(eventId)) {

            return;
          }
          
          setProcessedEventIds(prev => {
            const newSet = new Set([...prev, eventId]);
            if (newSet.size > 100) {
              const array = Array.from(newSet);
              return new Set(array.slice(-50));
            }
            return newSet;
          });
          
          const currentTime = Date.now();
          
          setSubscriptionData(prev => ({
            ...prev,
            gmEvents: [...prev.gmEvents, {
              blockHeight,
              blockHash,
              timestamp: Date.now(),
              type: 'new_block'
            }]
          }));
          
          setSubscriptionStatus(prev => ({
            ...prev,
            gmEvents: {
              ...prev.gmEvents,
              internalRefresh: true,
              lastUpdate: new Date().toISOString()
            }
          }));
          
          console.log('New subscription event:', eventId);

          if (refetch) refetch({ fetchPolicy: 'network-only', nextFetchPolicy: 'cache-and-network' });
          if (refetchWalletMessages) refetchWalletMessages({ fetchPolicy: 'network-only', nextFetchPolicy: 'cache-and-network' });
          
          setTimeout(() => {
            const currentRefetchMySentEvents = chatPartner ? refetchPartnerSentEvents : refetchMySentEvents;
            if (currentRefetchMySentEvents) currentRefetchMySentEvents({ fetchPolicy: 'network-only', nextFetchPolicy: 'cache-and-network' });
            if (refetchStreamEvents) refetchStreamEvents({ fetchPolicy: 'network-only', nextFetchPolicy: 'cache-and-network' });
          }, 100);
          
          setTimeout(() => {
            if (refetchGmRecord) refetchGmRecord({ fetchPolicy: 'network-only', nextFetchPolicy: 'cache-and-network' });
            if (refetchCooldownStatus) refetchCooldownStatus({ fetchPolicy: 'network-only', nextFetchPolicy: 'cache-and-network' });
            
            setSubscriptionStatus(prev => ({
              ...prev,
              gmEvents: {
                ...prev.gmEvents,
                internalRefresh: false
              }
            }));
          }, 500);
          
        } catch (error) {

        }
      }
    }
  });

  useEffect(() => {
    if (gmEventsError) {
      const retryTimeout = setTimeout(() => {
        if (chainId && subscriptionConnectionStatus.retryCount < 5) {
        }
      }, 5000);

      return () => clearTimeout(retryTimeout);
    }
  }, [gmEventsError, chainId, subscriptionConnectionStatus.retryCount]);

  const { data, refetch, error: queryError, loading } = useQuery(GET_GM_STATS, {
    variables: { chainId: queryChainId, owner: currentAccount ? formatAccountOwner(currentAccount) : null },
    fetchPolicy: "cache-first",
    skip: !isValidChainId(queryChainId),
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: "cache-first",
  });

   useEffect(() => {
    if (queryError) {
      if (queryError.message && queryError.message.includes('Failed to parse')) {
        return;
      }
      
      if (queryError.networkError?.statusCode === 500 && queryRetryCount < 3) {
        const retryTimeout = setTimeout(() => {
          setQueryRetryCount((prev) => prev + 1);
          refetch();
        }, 2000 * (queryRetryCount + 1));
        
        return () => clearTimeout(retryTimeout);
      }
    }
  }, [queryError, queryRetryCount, refetch]);

  const { data: gmRecordData, refetch: refetchGmRecord } = useQuery(GET_GM_RECORD, {
    variables: { owner: formatAccountOwner(currentAccount) },
    skip: !currentIsConnected || !currentAccount || !isValidAccountOwner(currentAccount),
    fetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: "cache-first",
  });

  const { data: walletMessagesData, refetch: refetchWalletMessages } = useQuery(GET_WALLET_MESSAGES, {
    variables: { owner: formatAccountOwner(currentAccount) },
    skip: !currentIsConnected || !currentAccount || !isValidAccountOwner(currentAccount),
    fetchPolicy: currentIsConnected ? "cache-first" : "network-only",
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: "cache-first",
  });

  const { data: leaderboardData, refetch: refetchLeaderboard } = useQuery(GET_LEADERBOARD, {
    variables: { 
      limit: 15 
    },
    skip: false,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: 'cache-first',
  });

  const { data: cooldownStatusData, refetch: refetchCooldownStatus } = useQuery(GET_COOLDOWN_STATUS, {
    fetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: "cache-first",
  });

  const { data: whitelistData, refetch: refetchWhitelist } = useQuery(IS_USER_WHITELISTED, {
    variables: { 
      user: formatAccountOwner(currentAccount) 
    },
    fetchPolicy: "cache-first",
    skip: !currentIsConnected || !currentAccount,
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: "cache-first",
  });

  const { data: invitationStatsDataRaw, refetch: refetchInvitationRewards } = useQuery(GET_INVITATION_STATS, {
    variables: { 
      user: formatAccountOwner(currentAccount) 
    },
    fetchPolicy: "cache-and-network",
    skip: !currentIsConnected || !currentAccount,
  });

  const { data: invitedUsersData, refetch: refetchInvitationRecord } = useQuery(GET_INVITATION_RECORD, {
    variables: { 
      user: formatAccountOwner(currentAccount) 
    },
    fetchPolicy: "cache-and-network",
    skip: !currentIsConnected || !currentAccount,
  });

  const invitationStatsData = {
    totalInvited: Number(invitationStatsDataRaw?.getInvitationStats?.total_invited) || 0,
    totalRewards: Number(invitationStatsDataRaw?.getInvitationStats?.total_rewards) || 0,
    lastRewardTime: invitationStatsDataRaw?.getInvitationStats?.last_reward_time || null
  };

  const getInvitedUsersList = useCallback(async () => {
    if (!currentAccount) return [];
    try {
      const response = await refetchInvitationRecord({
        inviter: formatAccountOwner(currentAccount)
      });
      const invitationRecords = response?.data?.getInvitationRecord || [];
      const records = Array.isArray(invitationRecords) ? invitationRecords : [invitationRecords];
      return records.filter(record => record && record.invitee);
    } catch (error) {

      return [];
    }
  }, [currentAccount, refetchInvitationRecord, formatAccountOwner]);

  const { data: cooldownCheckData, refetch: refetchCooldownCheck } = useQuery(CHECK_COOLDOWN, {
    variables: { 
      user: formatAccountOwner(currentAccount) 
    },
    fetchPolicy: "no-cache",
    skip: !currentAccount,
  });

  const [chatPartner, setChatPartner] = useState(null);
  
  const { data: mySentEventsData, refetch: refetchMySentEvents } = useQuery(GET_GM_EVENTS, {
    variables: { sender: formatAccountOwner(currentAccount) },
    skip: !currentIsConnected || !currentAccount || !isValidAccountOwner(currentAccount),
    fetchPolicy: "no-cache",
  });

  const { data: partnerSentEventsData, refetch: refetchPartnerSentEvents } = useQuery(GET_GM_EVENTS, {
    variables: { sender: currentChatPartner ? formatAccountOwner(currentChatPartner) : formatAccountOwner(currentAccount) },
    skip: !currentIsConnected || !currentAccount || !isValidAccountOwner(currentAccount),
    fetchPolicy: "no-cache",
  });

  const { data: myReceivedEventsData, refetch: refetchMyReceivedEvents, error: myReceivedError, loading: myReceivedLoading } = useQuery(GET_RECEIVED_GM_EVENTS, {
    variables: { recipient: formatAccountOwner(currentAccount) },
    skip: !currentIsConnected || !currentAccount || !isValidAccountOwner(currentAccount),
    fetchPolicy: "no-cache"
  });

  useEffect(() => {

  }, [myReceivedLoading, myReceivedError, myReceivedEventsData, currentAccount]);

  const { data: partnerReceivedEventsData, refetch: refetchPartnerReceivedEvents } = useQuery(GET_RECEIVED_GM_EVENTS, {
    variables: { recipient: currentChatPartner ? formatAccountOwner(currentChatPartner) : formatAccountOwner(currentAccount) },
    skip: !currentIsConnected || !currentAccount || !isValidAccountOwner(currentAccount),
    fetchPolicy: "no-cache"
  });

  const { data: streamEventsData, refetch: refetchStreamEvents, error: streamEventsError } = useQuery(GET_STREAM_EVENTS, {
    variables: { 
      chainId: queryChainId,
      limit: 100
    },
    skip: !isValidChainId(queryChainId),
    fetchPolicy: "cache-first",

  });

  const filterNewEvents = useCallback((events) => {
    if (!events || !Array.isArray(events)) {
      return [];
    }

    return events.filter(event => {
      if (!event || !event.timestamp) return false;
      return true;
    });
  }, []);

  const filteredStreamEvents = useMemo(() => {
    if (!streamEventsData?.getStreamEvents) return [];
    return filterNewEvents(streamEventsData.getStreamEvents);
  }, [streamEventsData, filterNewEvents]);

  useEffect(() => {
  }, [myReceivedEventsData, partnerSentEventsData, partnerReceivedEventsData, currentAccount, chatPartner, currentIsConnected]);

  const filteredMyReceivedEvents = useMemo(() => {
    if (!myReceivedEventsData?.getGmEvents) return [];
    const currentUser = formatAccountOwner(currentAccount);
    return filterNewEvents(myReceivedEventsData.getGmEvents)
      .filter(event => event.recipient === currentUser);
  }, [myReceivedEventsData, filterNewEvents, currentAccount]);

  const filteredMySentEvents = useMemo(() => {
    if (!mySentEventsData?.getGmEvents) return [];
    return filterNewEvents(mySentEventsData.getGmEvents);
  }, [mySentEventsData, filterNewEvents]);

  const filteredPartnerSentEvents = useMemo(() => {
    if (!partnerSentEventsData?.getGmEvents) return [];
    return filterNewEvents(partnerSentEventsData.getGmEvents);
  }, [partnerSentEventsData, filterNewEvents]);

  const filteredPartnerReceivedEvents = useMemo(() => {
    if (!partnerReceivedEventsData?.getGmEvents) return [];
    const partnerUser = currentChatPartner ? formatAccountOwner(currentChatPartner) : null;
    if (!partnerUser) return [];
    return filterNewEvents(partnerReceivedEventsData.getGmEvents)
      .filter(event => event.recipient === partnerUser);
  }, [partnerReceivedEventsData, filterNewEvents, currentChatPartner]);

  const [sendGm, { data: sendGmData, error: sendGmError }] = useMutation(SEND_GM, {
    update: () => {},
    errorPolicy: 'ignore',
    fetchPolicy: 'no-cache',
    context: {
      fetchOptions: {
        useGETForQueries: false,
      },
    },
  });

  const [setUserProfile, { data: setUserProfileData, error: setUserProfileError }] = useMutation(SET_USER_PROFILE, {
    update: () => {},
    errorPolicy: 'ignore',
    fetchPolicy: 'no-cache',
  });

  const { data: userProfileData, refetch: refetchUserProfile } = useQuery(GET_USER_PROFILE, {
    variables: { user: formatAccountOwner(currentAccount) },
    skip: !currentIsConnected || !currentAccount,
    fetchPolicy: 'cache-first',
  });

  useEffect(() => {
    if (sendGmData) {
      const result = typeof sendGmData === 'string' ? { hash: sendGmData } : sendGmData;
      onMutationComplete(result, 'sendGM');
    }
  }, [sendGmData, onMutationComplete]);

  useEffect(() => {
    if (sendGmError) {
      onMutationError(sendGmError);
    }
  }, [sendGmError, onMutationError]);
  const [setCooldownEnabled, { data: setCooldownEnabledData, error: setCooldownEnabledError }] = useMutation(SET_COOLDOWN_ENABLED, {
    update: () => {},
  });

  useEffect(() => {
    if (setCooldownEnabledData) {
      onMutationComplete(setCooldownEnabledData, 'setCooldown');
    }
  }, [setCooldownEnabledData, onMutationComplete]);

  useEffect(() => {
    if (setCooldownEnabledError) {
      onMutationError(setCooldownEnabledError);
    }
  }, [setCooldownEnabledError, onMutationError]);

  useEffect(() => {
    if (setUserProfileData) {
      const result = typeof setUserProfileData === 'string' ? { hash: setUserProfileData } : setUserProfileData;
      onMutationComplete(result, 'setUserProfile');
    }
  }, [setUserProfileData, onMutationComplete]);

  useEffect(() => {
    if (setUserProfileError) {
      onMutationError(setUserProfileError);
    }
  }, [setUserProfileError, onMutationError]);

  const handleSendGM = useCallback(async (content = "Gmicrochains", recipient = null, inviter = null, messageType = "text") => {
    if (!isValidAccountOwner(currentAccount)) {
      setMessage("Invalid wallet account", "error");
      setOperationStatus("error");
      return;
    }
    
    if (cooldownStatusData?.getCooldownStatus?.enabled === true && cooldownCheckData?.checkCooldown?.inCooldown) {
      const remainingTime = cooldownCheckData.checkCooldown.remainingTime;
      const formattedTime = formatCooldown(remainingTime);
      setMessage(`Within 24-hour cooldown period, please wait ${formattedTime} before sending`, "warning");
      setOperationStatus("error");
      return;
    }

    if (recipient) {
      if (!recipient.startsWith('0x') || !(/^0x[0-9a-fA-F]{40,64}$/.test(recipient))) {
        setMessage("Invalid recipient address (must be 0x followed by 64 or 40 hex characters)", "error");
        setOperationStatus("error");
        return;
      }
      
      if (recipient === formatAccountOwner(currentAccount)) {
        setMessage("Cannot send GMicrochains to yourself", "error");
        setOperationStatus("error");
        return;
      }
    }
    
    try {
      setOperationStatus("processing");
      await sendGm({
        variables: {
          chainId: targetChainId || currentChainId,
          sender: formatAccountOwner(currentAccount),
          recipient: recipient,
          messageType: messageType,
          content: content,
          inviter: inviter ? formatAccountOwner(inviter) : null,
        },
      });
    } catch (error) {
      onMutationError(error);
    }
  }, [currentAccount, currentChainId, targetChainId, inviter, sendGm, onMutationError, cooldownCheckData, setMessage, formatAccountOwner]);

  

  const handleSetCooldownEnabled = useCallback(async (enabled) => {
    if (!isValidAccountOwner(currentAccount)) {
      setMessage("Invalid wallet account", "error");
      setOperationStatus("error");
      return;
    }
    
    try {
      setOperationStatus("processing");
      const result = await setCooldownEnabled({
        variables: {
          caller: formatAccountOwner(currentAccount),
          enabled: enabled,
        },
      });
      
      const success = result?.data?.setCooldownEnabled?.success === true;
      if (!success) {
        setMessage("Insufficient permissions: only whitelist addresses can set the 24-hour limit switch", "warning");
        setOperationStatus("error");
        return;
      }
      await (refetchCooldownStatus && refetchCooldownStatus());
      await (refetchCooldownCheck && refetchCooldownCheck());
      setOperationStatus("success");
      
    } catch (error) {
      if (error && error.message && !error.message.includes('Mutation completed')) {
        onMutationError(error);
      } else {
        await (refetchCooldownStatus && refetchCooldownStatus());
        await (refetchCooldownCheck && refetchCooldownCheck());
        setOperationStatus("success");
      }
    }
  }, [currentAccount, setCooldownEnabled, onMutationError, setMessage, refetchCooldownStatus, refetchCooldownCheck]);

  const handleSetUserProfile = useCallback(async (userName, avatarData) => {
    if (!isValidAccountOwner(currentAccount)) {
      setMessage("Invalid wallet account", "error");
      setOperationStatus("error");
      return;
    }
    
    try {
      setOperationStatus("processing");
      const result = await setUserProfile({
        variables: {
          user: formatAccountOwner(currentAccount),
          profile: {
            name: userName,
            avatar: avatarData
          }
        }
      });
      
      if (result && result.data) {
        onMutationComplete(result.data, 'setUserProfile');
      }
      
      return result;
    } catch (error) {
      onMutationError(error);
      return null;
    }
  }, [currentAccount, setUserProfile, onMutationComplete, onMutationError, setMessage]);

  const validateRecipientAddress = useCallback((address) => {
    if (!address) {
      return { isValid: true, error: "" };
    }
    
    const formattedAddress = formatAccountOwner(address);
    if (!isValidAccountOwner(formattedAddress)) {
      return {
        isValid: false,
        error: "Invalid recipient address (must be 0x followed by 64 or 40 hex characters)"
      };
    }
    
    if (formattedAddress === currentAccount) {
      return {
        isValid: false,
        error: "Cannot send GMicrochains to yourself"
      };
    }
    
    return { isValid: true, error: "" };
  }, [currentAccount]);



  const safeInvitationStats = useMemo(() => {
    return {
      totalInvited: invitationStatsData?.getInvitationStats?.totalInvited || 0,
      totalRewards: invitationStatsData?.getInvitationStats?.totalRewards || 0,
      lastRewardTime: invitationStatsData?.getInvitationStats?.lastRewardTime || null
    };
  }, [invitationStatsData]);

  useEffect(() => {
    const handleToggleDropdown = async (event) => {
      const userId = event.detail.userId;
      const updateDropdownEvent = new CustomEvent('updateInvitedUsersDropdown', {
        detail: { userId }
      });
      window.dispatchEvent(updateDropdownEvent);
    };

    window.addEventListener('toggleInvitedUsersDropdown', handleToggleDropdown);
    return () => {
      window.removeEventListener('toggleInvitedUsersDropdown', handleToggleDropdown);
    };
  }, []);

  const setChatPartnerAddress = useCallback((partnerAddress) => {
    setChatPartner(partnerAddress);
  }, []);

  return {
    data: data || {},
    walletMessagesData: currentIsConnected ? (walletMessagesData || {}) : { walletMessages: null },
    mySentEventsData: filteredMySentEvents || [],
    partnerSentEventsData: filteredPartnerSentEvents || [],
    myReceivedEventsData: filteredMyReceivedEvents || [],
    partnerReceivedEventsData: filteredPartnerReceivedEvents || [],
    gmEventsData: chatPartner ? filteredPartnerSentEvents : [...filteredMySentEvents, ...filteredPartnerSentEvents],
    receivedGmEventsData: chatPartner ? filteredPartnerReceivedEvents : [...filteredMyReceivedEvents, ...filteredPartnerReceivedEvents],
    streamEventsData: filteredStreamEvents || [],
    loading,
    queryError,
    invitationStatsData: currentIsConnected ? (invitationStatsData || { totalInvited: 0, totalRewards: 0, lastRewardTime: null }) : { totalInvited: 0, totalRewards: 0, lastRewardTime: null },
    safeInvitationStats: currentIsConnected ? (safeInvitationStats || { totalInvited: 0, totalRewards: 0, lastRewardTime: null }) : { totalInvited: 0, totalRewards: 0, lastRewardTime: null },
    refetch,
    refetchGmEvents: chatPartner ? refetchPartnerSentEvents : refetchMySentEvents,
    refetchStreamEvents,
    refetchReceivedGmEvents: chatPartner ? refetchPartnerReceivedEvents : refetchMyReceivedEvents,
    refetchInvitationRewards,
    handleSendGM,
    handleSetCooldownEnabled,
    handleSetUserProfile,
    validateRecipientAddress,
    formatCooldown,
    isValidAccountOwner,
    formatAccountOwner,
    setChatPartnerAddress,
    currentChatPartner: chatPartner
  };
};

export const useLeaderboardData = () => {
  const { currentIsConnected } = useWallet();
  
  const { data: leaderboardData, loading: leaderboardLoading, error: leaderboardError, refetch: refetchLeaderboard } = useQuery(GET_LEADERBOARD, {
    variables: { 
      limit: 15 
    },
    skip: false,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: 'cache-first',
  });

  const { data: invitationLeaderboardData, loading: invitationLeaderboardLoading, error: invitationLeaderboardError, refetch: refetchInvitationLeaderboard } = useQuery(GET_INVITATION_LEADERBOARD, {
    variables: { 
      limit: 15 
    },
    skip: false,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: 'cache-first',
  });

  const [userProfiles, setUserProfiles] = useState({});

  const [getUserProfileQuery] = useLazyQuery(GET_USER_PROFILE, {
    fetchPolicy: 'cache-first',
  });

  const loading = leaderboardLoading || invitationLeaderboardLoading;
  const queryError = leaderboardError || invitationLeaderboardError;

  const getUserProfiles = useCallback(async (addresses) => {
    if (!addresses || addresses.length === 0) return {};
    
    const validAddresses = addresses.filter(addr => isValidAccountOwner(addr));
    if (validAddresses.length === 0) return {};

    try {
      const profilePromises = validAddresses.map(async (address) => {
        try {
          const { data } = await getUserProfileQuery({
            variables: { user: address }
          });
          
          if (data?.getUserProfile) {
            return { address, profile: data.getUserProfile };
          }
        } catch (error) {
          console.error(`Error fetching profile for ${address}:`, error);
        }
        return { address, profile: { name: '', avatar: '' } };
      });

      const results = await Promise.all(profilePromises);
      const profiles = {};
      results.forEach(({ address, profile }) => {
        profiles[address] = profile;
      });
      setUserProfiles(prev => ({ ...prev, ...profiles }));
      return profiles;
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
    return {};
  }, [getUserProfileQuery]);

  const getUserProfile = useCallback((address) => {
    return userProfiles[address] || { name: '', avatar: '' };
  }, [userProfiles]);

  useEffect(() => {
    if (leaderboardError) {
      console.error('Error fetching leaderboard:', leaderboardError);
    }
    if (invitationLeaderboardError) {
      console.error('Error fetching invitation leaderboard:', invitationLeaderboardError);
    }
  }, [leaderboardError, invitationLeaderboardError]);

  useEffect(() => {
    const allAddresses = [];
    
    if (leaderboardData?.getTopUsers) {
      leaderboardData.getTopUsers.forEach(entry => {
        if (entry.user && isValidAccountOwner(entry.user)) {
          allAddresses.push(entry.user);
        }
      });
    }
    
    if (invitationLeaderboardData?.getTopInviters) {
      invitationLeaderboardData.getTopInviters.forEach(entry => {
        if (entry.user && isValidAccountOwner(entry.user)) {
          allAddresses.push(entry.user);
        }
      });
    }
    
    if (allAddresses.length > 0) {
      getUserProfiles(allAddresses);
    }
  }, [leaderboardData, invitationLeaderboardData, getUserProfiles]);

  const stableRefetchLeaderboard = useCallback(() => {
    refetchLeaderboard && refetchLeaderboard();
  }, []);
  
  const stableRefetchInvitationLeaderboard = useCallback(() => {
    refetchInvitationLeaderboard && refetchInvitationLeaderboard();
  }, []);
  
  return useMemo(() => ({  
    leaderboardData,
    invitationLeaderboardData,
    userProfiles,
    loading,
    queryError,
    refetchLeaderboard: stableRefetchLeaderboard,
    refetchInvitationLeaderboard: stableRefetchInvitationLeaderboard,
    getUserProfile
  }), [
    JSON.stringify(leaderboardData),
    JSON.stringify(invitationLeaderboardData),
    userProfiles,
    loading,
    queryError,
    stableRefetchLeaderboard,
    stableRefetchInvitationLeaderboard,
    getUserProfile
  ]);
};

export const useCooldownData = ({ currentAccount, queryRetryCount, setQueryRetryCount, currentIsConnected }) => {
  const { data: cooldownStatusData, loading: cooldownStatusLoading, error: cooldownStatusError, refetch: refetchCooldownStatus } = useQuery(GET_COOLDOWN_STATUS, {
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
    skip: false,
  });

  const { data: cooldownCheckData, loading: cooldownCheckLoading, error: cooldownCheckError, refetch: refetchCooldownCheck } = useQuery(CHECK_COOLDOWN, {
    variables: { 
      user: currentAccount ? formatAccountOwner(currentAccount) : null 
    },
    skip: !currentAccount,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: 'cache-first',
  });

  const { data: whitelistData, loading: whitelistLoading, error: whitelistError, refetch: refetchWhitelist } = useQuery(IS_USER_WHITELISTED, {
    variables: { 
      user: currentAccount ? formatAccountOwner(currentAccount) : null
    },
    skip: !currentAccount,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: 'cache-first'
  });

  const loading = cooldownStatusLoading || cooldownCheckLoading || whitelistLoading;
  const queryError = cooldownStatusError || cooldownCheckError || whitelistError;

  useEffect(() => {
    if (whitelistError) {
      console.error('Error checking whitelist:', whitelistError);
      if (queryRetryCount < 3) {
        setTimeout(() => {
          setQueryRetryCount(prev => prev + 1);
          refetchWhitelist();
        }, 1000);
      }
    }
    if (cooldownStatusError) {
      console.error('Error fetching cooldown status:', cooldownStatusError);
    }
    if (cooldownCheckError) {
      console.error('Error checking cooldown:', cooldownCheckError);
    }
  }, [whitelistError, cooldownStatusError, cooldownCheckError, queryRetryCount, setQueryRetryCount, refetchWhitelist]);

  return useMemo(() => ({
    cooldownStatusData,
    cooldownCheckData,
    whitelistData,
    loading,
    queryError,
    refetchCooldownStatus,
    refetchCooldownCheck,
    refetchWhitelist
  }), [
    cooldownStatusData,
    cooldownCheckData,
    whitelistData,
    loading,
    queryError
  ]);
};

export const useUserData = ({ chainId, currentAccount, queryRetryCount, setQueryRetryCount, currentIsConnected }) => {
  const { data: invitationStatsDataRaw, loading: invitationStatsLoading, error: invitationStatsError, refetch: refetchInvitationStats } = useQuery(GET_INVITATION_STATS, {
    variables: { 
      user: currentAccount ? formatAccountOwner(currentAccount) : null
    },
    skip: !currentAccount || !isValidAccountOwner(currentAccount),
    fetchPolicy: 'cache-first',
    pollInterval: 0,
    nextFetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false
  });

  const { data: invitationRecordData, loading: invitationRecordLoading, error: invitationRecordError, refetch: refetchInvitationRecord } = useQuery(GET_INVITATION_RECORD, {
    variables: { 
      inviter: currentAccount ? formatAccountOwner(currentAccount) : null
    },
    skip: !currentAccount || !isValidAccountOwner(currentAccount),
    fetchPolicy: 'cache-first',
    pollInterval: 0,
    nextFetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false
  });

  const { data: gmRecordData, loading: gmRecordLoading, error: gmRecordError, refetch: refetchGmRecord } = useQuery(GET_GM_RECORD, {
    variables: { 
      owner: currentAccount ? formatAccountOwner(currentAccount) : null,
      chainId: chainId 
    },
    skip: !currentIsConnected || !currentAccount || !chainId || !isValidAccountOwner(currentAccount),
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
    pollInterval: 0,
    nextFetchPolicy: 'cache-first'
  });

  const invitationStatsData = {
    totalInvited: Number(invitationStatsDataRaw?.getInvitationStats?.totalInvited) || 0,
    totalRewards: Number(invitationStatsDataRaw?.getInvitationStats?.totalRewards) || 0,
    lastRewardTime: invitationStatsDataRaw?.getInvitationStats?.lastRewardTime || null
  };
  
  const loading = invitationStatsLoading || invitationRecordLoading || gmRecordLoading;
  const queryError = invitationStatsError || invitationRecordError || gmRecordError;

  useEffect(() => {
    if (invitationStatsError) {
      console.error('Error fetching invitation stats:', invitationStatsError);
    }
    if (invitationRecordError) {
      console.error('Error fetching invitation records:', invitationRecordError);
    }
    if (gmRecordError) {
      console.error('Error fetching GM record:', gmRecordError);
      if (queryRetryCount < 3) {
        setTimeout(() => {
          setQueryRetryCount(prev => prev + 1);
          refetchGmRecord();
        }, 1000);
      }
    }
  }, [invitationStatsError, invitationRecordError, gmRecordError, queryRetryCount, setQueryRetryCount, refetchGmRecord]);

  useEffect(() => {
    const handleToggleDropdown = async (event) => {
      const userId = event.detail.userId;
      try {
        if (!userId) {
          window.dispatchEvent(new CustomEvent('updateInvitedUsersDropdown', {
            detail: { userId, invitedUsers: [] }
          }));
          return;
        }
        
        const result = await refetchInvitationRecord({
          inviter: formatAccountOwner(userId)
        });
        const invitedUsers = result.data?.getInvitationRecord || [];
        window.dispatchEvent(new CustomEvent('updateInvitedUsersDropdown', {
          detail: { userId, invitedUsers }
        }));
      } catch (error) {
        console.error('Error fetching invitation records:', error);
        window.dispatchEvent(new CustomEvent('updateInvitedUsersDropdown', {
          detail: { userId, invitedUsers: [] }
        }));
      }
    };

    window.addEventListener('toggleInvitedUsersDropdown', handleToggleDropdown);
    return () => {
      window.removeEventListener('toggleInvitedUsersDropdown', handleToggleDropdown);
    };
  }, [refetchInvitationRecord, currentAccount]);

  return useMemo(() => ({
    gmRecordData,
    invitationStatsData,
    invitationRecordData,
    loading,
    queryError,
    refetchGmRecord,
    refetchInvitationStats,
    refetchInvitationRecord
  }), [
    gmRecordData,
    invitationStatsData,
    invitationRecordData,
    loading,
    queryError
  ]);
};

export const useGMAdditionalData = ({ chainId, currentAccount, currentChainId, walletType, queryRetryCount, setQueryRetryCount, currentIsConnected }) => {
  const leaderboardData = useLeaderboardData();
  const cooldownData = useCooldownData({ currentAccount, queryRetryCount, setQueryRetryCount, currentIsConnected });
  const userData = useUserData({ chainId, currentAccount, queryRetryCount, setQueryRetryCount, currentIsConnected });

  return useMemo(() => ({
    ...leaderboardData,
    ...cooldownData,
    ...userData
  }), [leaderboardData, cooldownData, userData]);
};

export default GMOperations;