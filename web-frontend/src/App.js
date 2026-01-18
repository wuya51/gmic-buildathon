import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWallet, WalletConnector } from './providers';
import { DynamicConnectButton, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import GMOperations, { useGMAdditionalData, useLeaderboardData, useCooldownData, useUserData } from './services/GMOperations';
import NotificationCenter from './pages/NotificationCenter';
import Leaderboard from './pages/Leaderboard';
import GifPicker from './components/GifPicker';
import EmojiPicker from './components/EmojiPicker';
import ChatHistory from './components/ChatHistory';
import UserProfile from './components/UserProfile';
import { formatAccountOwner, formatAddressForDisplay, uploadToPinata, MAX_MESSAGE_LENGTH, WARNING_THRESHOLD } from './utils';
import { BUTTON_STYLES, CARD_STYLES, TEXT_STYLES, INPUT_STYLES, BADGE_STYLES, MODAL_STYLES, NOTIFICATION_STYLES, NAVIGATION_STYLES, HEADER_STYLES, CHAT_STYLES } from './utils/styles';

const KeyboardIcon = ({ className = "" }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
    <line x1="7" y1="8" x2="13" y2="8"></line>
    <line x1="7" y1="12" x2="17" y2="12"></line>
    <line x1="7" y1="16" x2="15" y2="16"></line>
  </svg>
);

const VoiceIcon = ({ className = "" }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error captured:', {
    message,
    source,
    lineno,
    colno,
    error,
    stack: error ? error.stack : null
  });
  return true;
};

window.onunhandledrejection = function(event) {
  console.error('Global unhandled promise rejection captured:', {
    reason: event.reason,
    stack: event.reason ? event.reason.stack : null,
    promise: event.promise
  });
  return true;
};



class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React component error captured by ErrorBoundary:', {
      error,
      errorInfo,
      stack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
    <div className="flex justify-center items-center min-h-screen p-4 bg-[#f8f5ed]">
      <div className="max-w-md bg-white border border-red-500 rounded-lg shadow-lg p-8 text-center animate-fadeIn">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-500 mb-4">Oops! Something went wrong</h2>
        <p className="text-lg text-gray-600 mb-6">We're sorry, but something unexpected happened.</p>
        <details className="mb-6 text-left">
          <summary className="cursor-pointer font-semibold text-red-500 mb-2">Technical Details (for developers)</summary>
          <div className="text-sm bg-gray-50 p-4 rounded border border-gray-200">
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </div>
        </details>
        <button 
          className={`${BUTTON_STYLES.primary} px-6 py-2 rounded-md font-semibold transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md hover:shadow-red-500/30`}
          onClick={() => this.setState({ hasError: false })}
        >
          Try Again
        </button>
      </div>
    </div>
  );
    }

    return this.props.children;
  }
}

function App({ chainId, appId, ownerId, inviter, port }) {
  const appRenderCountRef = useRef(0);
  appRenderCountRef.current += 1;
  
  const forceUpdateRef = useRef(0);
  const cooldownRemainingRef = useRef(0);
  const activeTabRef = useRef('unknown');
  const userProfilesCache = useRef(new Map());
  const getUserProfile = useCallback(async (address) => {
    if (!address) return null;
    if (userProfilesCache.current.has(address)) {
      return userProfilesCache.current.get(address);
    }
    try {
      const defaultContacts = {
        [import.meta.env.VITE_APP_ID]: {
          name: 'GMIC',
          avatar: '🤖'
        }
      };
      
      if (ownerId) {
        defaultContacts[ownerId] = {
          name: 'GMIC Owner',
          avatar: '👑'
        };
      }
      if (defaultContacts[address]) {
        userProfilesCache.current.set(address, defaultContacts[address]);
        return defaultContacts[address];
      }
      const defaultProfile = {
        name: formatAddressForDisplay(address),
        avatar: '👤'
      };
      userProfilesCache.current.set(address, defaultProfile);
      return defaultProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      const defaultProfile = {
        name: formatAddressForDisplay(address),
        avatar: '👤'
      };
      userProfilesCache.current.set(address, defaultProfile);
      return defaultProfile;
    }
  }, [ownerId]);
  
  const pageLoadTime = useRef(0);
  const [appState, setAppState] = useState({
    ui: {
      isMobile: window.innerWidth <= 768,
      activeTab: localStorage.getItem('activeTab') || 'messages',
      showLeaderboard: true,
      showProfileSettings: false,
      showEmojiPicker: false,
      showGifPicker: false,
      showVoicePopup: false,
      showContactList: false,
      showHistoryDropdown: false,
      showShareReferralModal: false,
      showInvitedUsersDropdown: false
    },
    message: {
      customMessage: '',
      selectedMessage: 'gm',
      isVoiceMode: false,
      isRecording: false,
      recordingTime: 0,
      selectedGif: '',
      messageInputFocused: false,
      isSendingMessage: false
    },
    operation: {
      operationStatus: null,
      claimStatus: null,
      errorMessage: "",
      cooldownRemaining: 0,
      addressValidationError: "",
      profileSaveStatus: null
    }
  });

  const { activeTab, showLeaderboard, showProfileSettings, showEmojiPicker, showGifPicker, showVoicePopup, showContactList, showHistoryDropdown, showShareReferralModal, showInvitedUsersDropdown } = appState.ui;
  const { customMessage, selectedMessage, isVoiceMode, isRecording, recordingTime, selectedGif, messageInputFocused, isSendingMessage } = appState.message;
  const { operationStatus, claimStatus, errorMessage, cooldownRemaining, addressValidationError, profileSaveStatus } = appState.operation;

  const setActiveTab = (tab) => updateAppState('ui', { activeTab: tab });
  const setShowLeaderboard = (show) => updateAppState('ui', { showLeaderboard: show });
  const setShowProfileSettings = (show) => updateAppState('ui', { showProfileSettings: show });
  const setShowEmojiPicker = (show) => updateAppState('ui', { showEmojiPicker: show });
  const setShowGifPicker = (show) => updateAppState('ui', { showGifPicker: show });
  const setShowVoicePopup = (show) => updateAppState('ui', { showVoicePopup: show });
  const setShowContactList = (show) => updateAppState('ui', { showContactList: show });
  const setShowHistoryDropdown = (show) => updateAppState('ui', { showHistoryDropdown: show });
  const setShowShareReferralModal = (show) => updateAppState('ui', { showShareReferralModal: show });
  const setShowInvitedUsersDropdown = (show) => updateAppState('ui', { showInvitedUsersDropdown: show });
  const setCustomMessage = (message) => updateAppState('message', { customMessage: message });
  const setSelectedMessage = (message) => updateAppState('message', { selectedMessage: message });
  const setIsVoiceMode = (mode) => updateAppState('message', { isVoiceMode: mode });
  const setIsRecording = (recording) => updateAppState('message', { isRecording: recording });
  const setRecordingTime = (time) => updateAppState('message', { recordingTime: time });
  const setSelectedGif = (gif) => updateAppState('message', { selectedGif: gif });
  const setMessageInputFocused = (focused) => updateAppState('message', { messageInputFocused: focused });
  const setIsSendingMessage = (sending) => updateAppState('message', { isSendingMessage: sending });
  const setOperationStatus = (status) => updateAppState('operation', { operationStatus: status });
  const setClaimStatus = (status) => updateAppState('operation', { claimStatus: status });
  const setErrorMessage = (message) => updateAppState('operation', { errorMessage: message });
  const setCooldownRemaining = (remaining) => updateAppState('operation', { cooldownRemaining: remaining });
  const setAddressValidationError = (error) => updateAppState('operation', { addressValidationError: error });
  const setProfileSaveStatus = (status) => updateAppState('operation', { profileSaveStatus: status });

  const updateAppState = (category, updates) => {
    setAppState(prev => ({
      ...prev,
      [category]: { ...prev[category], ...updates }
    }));
  };

  const [urlInviter, setUrlInviter] = useState(null);
  
  const isButtonDisabled = (operationStatus, currentAccount, gmOps, cooldownRemaining = 0, localCooldownEnabled = false, isConnected = false) => {
    return operationStatus === "processing" || 
      !isConnected ||
      (currentAccount && !gmOps.isValidAccountOwner(currentAccount)) || 
      (currentAccount && localCooldownEnabled && cooldownRemaining > 0);
  };
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviterParam = urlParams.get('inviter');
    
    if (inviterParam) {
      const formattedInviter = formatAccountOwner(inviterParam);
      setUrlInviter(formattedInviter);

      localStorage.setItem('urlInviter', formattedInviter); 
      addNotification(`You were invited by: ${formattedInviter.slice(0, 8)}...${formattedInviter.slice(-6)}`, 'info');
    }
    
    pageLoadTime.current = Date.now();
    pageLoadTimestampRef.current = pageLoadTime.current;
  }, [ownerId]);
  
  const [connectionError, setConnectionError] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");

  
  let walletState = {};
  try {
    if (typeof useWallet !== 'function') {
      throw new Error('useWallet is not available - WalletProvider may not be properly configured');
    }
    
    walletState = useWallet();
    
    if (!walletState || typeof walletState !== 'object') {
      throw new Error('Invalid wallet state returned from useWallet hook');
    }
    
    if (typeof walletState.connectWallet !== 'function') {
      walletState.connectWallet = () => Promise.reject(new Error('Wallet connection not available'));
    }
    
    if (typeof walletState.disconnectWallet !== 'function') {
      walletState.disconnectWallet = () => Promise.resolve();
    }
    
  } catch (error) {
    walletState = {
      account: null,
      isConnected: false,
      chainId: chainId || null,
      walletChainId: null,
      walletType: null,
      isLoading: false,
      error: error.message || 'Wallet initialization failed',
      connectWallet: () => {
        return Promise.reject(new Error('Wallet is in error state'));
      },
      disconnectWallet: () => {
        return Promise.resolve();
      },
      isValidAccountOwner: () => false,
      formatCooldown: (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    };
    
    setConnectionError(error.message || 'Wallet connection failed');
  }
  
  const { 
    account: connectedAccount, 
    isConnected, 
    chainId: connectedChainId,
    walletChainId: connectedWalletChainId,
    walletType,
    isLoading: walletLoading,
    error: walletError,
    connectWallet, 
    disconnectWallet 
  } = walletState;

  const [recipientAddress, setRecipientAddress] = useState("");
  const getInitialTargetChainId = () => {
    const savedTargetChainId = localStorage.getItem('targetChainId');
    return savedTargetChainId || chainId;
  };
  const [targetChainId, setTargetChainId] = useState(getInitialTargetChainId());
  const [queryRetryCount, setQueryRetryCount] = useState(0);
  const [previousTotalMessages, setPreviousTotalMessages] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [cooldownStatus, setCooldownStatus] = useState(null);
  const [localCooldownEnabled, setLocalCooldownEnabled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [gmRecords, setGmRecords] = useState([]);
  const previousEventCountRef = useRef(0);
  const previousLatestTimestampRef = useRef(0);
  const pageLoadTimestampRef = useRef(0);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customMessageEnabled, setCustomMessageEnabled] = useState(true);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [voicePopupText, setVoicePopupText] = useState('');
  const [voicePopupType, setVoicePopupType] = useState('normal');
  const [isMessageInputActive, setIsMessageInputActive] = useState(false);
  const [newRecipientAddress, setNewRecipientAddress] = useState('');
  const [newRecipientValidationError, setNewRecipientValidationError] = useState('');
  const [recentContacts, setRecentContacts] = useState([
    {
      address: import.meta.env.VITE_WHITELIST_ADDRESS,
      name: 'wuya51',
      avatar: '👤'
    }
  ]);


  const [currentUserOnChainData, setCurrentUserOnChainData] = useState({});
  const [currentChatPartner, setCurrentChatPartner] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const handleChatPartnerChange = (partnerAddress) => {
    if (partnerAddress) {
      setRecipientAddress(partnerAddress);
      setCurrentChatPartner(partnerAddress);
    } else {
      setRecipientAddress('');
      setCurrentChatPartner(null);
    }
  };

  useEffect(() => {
    if (currentChatPartner && currentChatPartner !== recipientAddress) {
      setRecipientAddress(currentChatPartner);
    }
  }, [currentChatPartner, recipientAddress]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const resetRecordingState = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    updateAppState('message', { 
      isRecording: false,
      recordingTime: 0 
    });
    updateAppState('ui', { showVoicePopup: false });
  }, [ownerId]);
  
  const addEmojiToMessage = (emoji) => {
    updateAppState('message', { 
      customMessage: appState.message.customMessage + emoji 
    });
    updateAppState('ui', { showEmojiPicker: false });
    updateAppState('message', { messageInputFocused: true });
  };

  const isVoiceRecordingSupported = () => {
    return navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder;
  };

  const handleVoiceRecording = () => {
  };

  const handleVoicePressStart = async () => {
    if (!isVoiceRecordingSupported()) {
      setVoicePopupText('Voice recording not supported');
      setVoicePopupType('error');
      updateAppState('ui', { showVoicePopup: true });
      setTimeout(() => updateAppState('ui', { showVoicePopup: false }), 2000);
      return;
    }
    
    resetRecordingState();

    updateAppState('ui', { showVoicePopup: true });
    setVoicePopupText('Recording...');
    setVoicePopupType('recording');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {

          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);

          }
        };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        
        stream.getTracks().forEach(track => track.stop());

      };

      mediaRecorder.start(100);
      updateAppState('message', { 
        isRecording: true,
        recordingTime: 0 
      });

      let startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const displayTime = Math.min(elapsed, 10);
        
        updateAppState('message', { recordingTime: displayTime });
        setVoicePopupText(`Recording... ${displayTime.toFixed(1)}s`);
        
        if (elapsed >= 10 && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            updateAppState('message', { isRecording: false });
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
            const timestamp = performance.now();
            const microTimestamp = Math.floor(timestamp * 1000);
            const filename = `gmic-voice-${microTimestamp}.webm`;
            
            setVoicePopupText('Auto-sent (max 10s)');
            setVoicePopupType('success');
            updateAppState('ui', { showVoicePopup: true });
            setTimeout(() => updateAppState('ui', { showVoicePopup: false }), 1500);
            
            const audioData = [...audioChunksRef.current];
            audioChunksRef.current = [];
            
            saveVoiceToLocal(audioData, filename);
          }
      }, 100);
    } catch (error) {

      setVoicePopupText('Cannot access microphone');
      setVoicePopupType('error');
      updateAppState('message', { isRecording: false });
    }
  };

  const handleVoicePressEnd = () => {
    updateAppState('ui', { showVoicePopup: false });
    
    if (appState.message.isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      updateAppState('message', { isRecording: false });
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (appState.message.recordingTime < 1) {
        setVoicePopupText('Recording too short (min 1s)');
        setVoicePopupType('error');
        updateAppState('ui', { showVoicePopup: true });
        setTimeout(() => {
          updateAppState('ui', { showVoicePopup: false });
          resetRecordingState();
        }, 1500);
      } else {
        const timestamp = performance.now();
        const microTimestamp = Math.floor(timestamp * 1000);
        const filename = `gmic-voice-${microTimestamp}.webm`;
        
        setVoicePopupText('Uploading voice message...');
        setVoicePopupType('info');
        updateAppState('ui', { showVoicePopup: true });
        
        const audioData = [...audioChunksRef.current];
        audioChunksRef.current = [];
        saveVoiceToLocal(audioData, filename);
      }
    }
  };

  const saveVoiceToLocal = async (audioChunks, filename) => {
    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      
      const result = await uploadToPinata(audioBlob, filename);
      
      if (result && result.success && result.url) {
        const voiceUrl = result.url;
        handleSendGM('voice', voiceUrl);
        setVoicePopupText('Voice message sent!');
        setVoicePopupType('success');
        updateAppState('ui', { showVoicePopup: true });
        setTimeout(() => {
          updateAppState('ui', { showVoicePopup: false });
          resetRecordingState();
        }, 1500);
      } else {
        throw new Error(result?.error || 'Upload failed - no IPFS hash returned');
      }
      
    } catch (error) {
      console.error('❌ Error uploading voice file:', error);
      
      setVoicePopupText('Failed to send voice message');
      setVoicePopupType('error');
      updateAppState('ui', { showVoicePopup: true });
      setTimeout(() => {
        updateAppState('ui', { showVoicePopup: false });
        resetRecordingState();
      }, 2000);
    }
  };



  const saveVoiceToServer = async (audioChunks, filename) => {
    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('voice', audioBlob, filename);
      formData.append('timestamp', Date.now().toString());
      
      const response = await fetch('/api/save-voice', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
  
      }
    } catch (error) {
    }
  };
  const [invitedUsersList, setInvitedUsersList] = useState([]);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [invitedUsersLoading, setInvitedUsersLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const handleImportAds = (event) => {
    try {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const importedSettings = JSON.parse(e.target.result);
          if (Array.isArray(importedSettings) && importedSettings.every(ad => 
            typeof ad === 'object' && ad !== null && 
            typeof ad.url === 'string' && 
            typeof ad.imageUrl === 'string'
          )) {
            setAdSettings(importedSettings.slice(0, 10));
            addNotification('Ad settings imported successfully!', 'success');
          } else {
            addNotification('Invalid ad settings file. Please check the format.', 'error');
          }
        };
        reader.readAsText(file);
      }
    } catch (error) {

      addNotification('Failed to import ad settings. Please try again.', 'error');
    }
    event.target.value = '';
  };
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleResize = () => {
    setWindowWidth(window.innerWidth);
    updateAppState('ui', { isMobile: window.innerWidth <= 768 });
  };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);



  forceUpdateRef.current = forceUpdate;
  cooldownRemainingRef.current = appState.operation.cooldownRemaining;
  activeTabRef.current = appState.ui.activeTab;
  
  const addNotification = useCallback((message, type = 'info') => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const id = `${timestamp}-${randomSuffix}`;
    const newNotification = {
      id,
      message,
      type,
      timestamp: Date.now()
    };
    
    const isOverlayNotification = 
      (type === 'success' && (message.includes('send') || message.includes('sent') || 
                              message.includes('connect') || message.includes('connected') ||
                              message.includes('voice message') || message.includes('voice'))) ||
      (type === 'success' && message.includes('Wallet connected')) ||
      (type === 'success' && message.includes('Connected to wallet'));
    
    if (isOverlayNotification) {
      setNotifications([newNotification]);
    } else {
      setNotifications(prev => [...prev, newNotification]);
    }
    
    setTimeout(() => {
      removeNotification(id);
    }, 2000);
  }, []);
  
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const handleAvatarFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      addNotification('Please select a valid image file', 'error');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      addNotification('Image size should be less than 5MB', 'error');
      return;
    }
    
    setSelectedAvatarFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatarToPinata = async (file) => {
    try {
      setUploading(true);
      
      const timestamp = Date.now();
      const filename = `avatar-${timestamp}-${currentAccount.substring(2, 10)}.${file.name.split('.').pop()}`;
      
      const result = await uploadToPinata(file, filename);
      
      if (result && result.success && result.url) {
        return result.url;
      } else {
        throw new Error('Avatar upload failed');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      addNotification('Failed to upload avatar', 'error');
      throw error;
    } finally {
      setUploading(false);
    }
  };
 
  const handleCustomMessageToggle = useCallback(() => {
    setCustomMessageEnabled(!customMessageEnabled);
    if (!customMessageEnabled) {
      updateAppState('message', { selectedMessage: appState.message.customMessage || 'gm' });
    } else {
      updateAppState('message', { selectedMessage: 'gm' });
    }
  }, [customMessageEnabled, appState.message.customMessage]);

  const isMessageContentValid = useCallback((content) => {
    if (content.length > 280) {
      addNotification("Message too long. Maximum 280 characters allowed.", "error");
      return false;
    }
    
    if (content.includes('<script') || content.includes('</script>') || 
       content.includes('<iframe') || content.includes('javascript:')) {
      addNotification("Invalid content. HTML tags and scripts are not allowed.", "error");
      return false;
    }
    
    const sensitiveWords = [
      "spam", "abuse", "hate", "violence", "illegal", "scam", "fraud"
    ];
    
    const contentLower = content.toLowerCase();
    for (const word of sensitiveWords) {
      if (contentLower.includes(word)) {
        addNotification(`Invalid content. Please remove inappropriate words like "${word}".`, "error");
        return false;
      }
    }
    
    return true;
  }, [addNotification]);

  const handleCustomMessageChange = useCallback((e) => {
    const value = e.target.value;

    updateAppState('message', { customMessage: value });
    if (customMessageEnabled) {
      updateAppState('message', { selectedMessage: value || 'gm' });
      
      if (value && !isMessageContentValid(value)) {

      }
    }
  }, [customMessageEnabled, isMessageContentValid]);

  const handleLongPressStart = () => {
    if (isButtonDisabled(appState.operation.operationStatus, currentAccount, gmOps, appState.operation.cooldownRemaining, localCooldownEnabled, currentIsConnected)) {
      return;
    }
    
    setIsLongPressing(true);
    const timer = setTimeout(() => {
      updateAppState('message', { isVoiceMode: true });
      setIsLongPressing(false);
    }, 1000);
    
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressing(false);
  };
 
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (appState.ui.showEmojiPicker && 
          !event.target.closest('.emoji-picker-container') && 
          !event.target.closest('.emoji-picker-button')) {
        updateAppState('ui', { showEmojiPicker: false });
      }
      
      if (appState.ui.showGifPicker && 
          !event.target.closest('.gif-picker-container') && 
          !event.target.closest('.gif-picker-button')) {
        updateAppState('ui', { showGifPicker: false });
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [appState.ui.showEmojiPicker, appState.ui.showGifPicker]);

  const [currentAccount, setCurrentAccount] = useState(null);
  useEffect(() => {
    if (connectedAccount) {
      const formattedAccount = formatAccountOwner(connectedAccount);
      setCurrentAccount(formattedAccount);
    } else {
      setCurrentAccount(null);
    }
  }, [connectedAccount]);

  useEffect(() => {
    if (currentAccount) {
      try {
        const savedProfile = localStorage.getItem(`userProfile_${currentAccount}`);
        if (savedProfile) {
          const profile = JSON.parse(savedProfile);
          setUserProfile(profile);
          setEditUsername(profile.username || '');
          setEditAvatar(profile.avatar || '');
        } else {
          setUserProfile(null);
          setEditUsername('');
          setEditAvatar('');
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
      }
    } else {
      setUserProfile(null);
      setEditUsername('');
      setEditAvatar('');
    }
  }, [currentAccount]);
  const currentChainId = connectedChainId;
  const currentIsConnected = isConnected;

  useEffect(() => {
    console.log('Wallet connection status changed:', {
      isConnected: currentIsConnected,
      account: currentAccount,
      chainId: currentChainId,
      walletType: walletType,
      timestamp: new Date().toISOString()
    });
  }, [currentIsConnected, currentAccount, currentChainId, walletType]);

  const memoizedCurrentAccount = useMemo(() => currentAccount, [currentAccount]);
  const memoizedIsMobile = useMemo(() => appState.ui.isMobile, [appState.ui.isMobile]);
  
  const handleToggleShareReferral = useCallback(() => {
    updateAppState('ui', { showShareReferralModal: !appState.ui.showShareReferralModal });
  }, [appState.ui.showShareReferralModal]);
  
  const fallbackCopyTextToClipboard = useCallback((text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        const btn = document.querySelector('.copy-btn');
        if (btn) {
          const originalText = btn.textContent;
          const originalClasses = btn.className;
          
          btn.textContent = 'Copied!';
          btn.className = `${originalClasses} bg-[#ff2a00] text-white font-bold px-2 py-0.5 rounded`;
          
          setTimeout(() => {
            btn.textContent = originalText;
            btn.className = originalClasses;
          }, 1000);
        }

      } else {
        throw new Error('Copy command failed');
      }
    } catch (err) {

      alert('Failed to copy referral link');
    } finally {
      document.body.removeChild(textArea);
    }
  }, []);
  
  const { primaryWallet, handleLogOut } = useDynamicContext();
  
  const isDynamicConnected = (primaryWallet && primaryWallet.address) || (walletType === 'dynamic' && isConnected);
  const dynamicAccount = isDynamicConnected ? formatAccountOwner(primaryWallet?.address || currentAccount) : null;
  const isActiveDynamicWallet = (isConnected && walletType === 'dynamic' && currentAccount) || (primaryWallet && primaryWallet.address && walletType === 'dynamic');
  
  useEffect(() => {
    if (primaryWallet && primaryWallet.address && !isActiveDynamicWallet) {
      const timer = setTimeout(() => {
        if (primaryWallet && primaryWallet.address && !isActiveDynamicWallet) {
          connectWallet('dynamic');
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [primaryWallet, isActiveDynamicWallet, connectWallet]);
  
  const [isDynamicLoading, setIsDynamicLoading] = useState(false);
  
  const prevWalletStateRef = useRef({ primaryWallet: null, walletType: null });
  useEffect(() => {
    const prevState = prevWalletStateRef.current;
    const wasNotDynamic = prevState.walletType !== 'dynamic' || !prevState.primaryWallet?.address;
    const isNowDynamicConnected = primaryWallet && primaryWallet.address && walletType === 'dynamic' && isConnected;

    
    if (wasNotDynamic && isNowDynamicConnected) {
      addNotification('Dynamic wallet: connected', 'success');
    }
    
    const switchedToDynamic = prevState.walletType !== 'dynamic' && walletType === 'dynamic' && isConnected && primaryWallet?.address;
        
    if (switchedToDynamic) {
      addNotification('Dynamic wallet: connected', 'success');
    }
    
    prevWalletStateRef.current = { primaryWallet, walletType };
  }, [primaryWallet, walletType, isConnected, addNotification]);
  
  useEffect(() => {
    if (primaryWallet && primaryWallet.address) {
      setIsDynamicLoading(false);
    }
  }, [primaryWallet]);

  useEffect(() => {
    if (walletType === 'dynamic') {
      isManualTargetChainChange.current = false;
      setTargetChainId(chainId);
    } else if (walletType === 'linera' && connectedWalletChainId) {
      if (!localStorage.getItem('targetChainId')) {
        isManualTargetChainChange.current = false;
        setTargetChainId(connectedWalletChainId);
      }
    }
  }, [walletType, connectedWalletChainId, chainId]);


  
  useEffect(() => {
    localStorage.setItem('activeTab', appState.ui.activeTab);
    activeTabRef.current = appState.ui.activeTab;
    
    const saveTimeout = setTimeout(() => {
      const currentSaved = localStorage.getItem('activeTab');
      if (currentSaved !== appState.ui.activeTab) {
        localStorage.setItem('activeTab', appState.ui.activeTab);
      }
    }, 100);
    
    return () => clearTimeout(saveTimeout);
  }, [appState.ui.activeTab]);

  useEffect(() => {
    const checkAndRestoreActiveTab = () => {
      try {
        const saved = localStorage.getItem('activeTab');
        if (saved && saved !== appState.ui.activeTab && ['messages', 'leaderboards', 'settings'].includes(saved)) {
          updateAppState('ui', { activeTab: saved });
        }
      } catch (error) {

      }
    };

    checkAndRestoreActiveTab();
    
    const handleErrorBoundaryRecovery = () => {
      setTimeout(checkAndRestoreActiveTab, 100);
    };

    window.addEventListener('error', handleErrorBoundaryRecovery);
    window.addEventListener('unhandledrejection', handleErrorBoundaryRecovery);
    
    return () => {
      window.removeEventListener('error', handleErrorBoundaryRecovery);
      window.removeEventListener('unhandledrejection', handleErrorBoundaryRecovery);
    };
  }, [appState.ui.activeTab]);

  useEffect(() => {
    const tabCheckInterval = setInterval(() => {
      try {
        const saved = localStorage.getItem('activeTab');
        const isValidTab = ['messages', 'leaderboards', 'settings'].includes(appState.ui.activeTab);
        const isSavedValid = saved && ['messages', 'leaderboards', 'settings'].includes(saved);
        
        if (!isValidTab && isSavedValid) {
          updateAppState('ui', { activeTab: saved });
          activeTabRef.current = saved;
        }
      } catch (error) {

      }
    }, 10000);

    return () => clearInterval(tabCheckInterval);
  }, [appState.ui.activeTab]);
  
  const disconnectDynamicWallet = async (disconnectWalletFn) => {
    try {
      if (handleLogOut) {
        await handleLogOut();
      }
      await disconnectWalletFn();
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      throw error;
    }
  };
  
  const WalletConnectionSection = React.memo((props) => {
    const {
      isDynamicConnected,
      isActiveDynamicWallet,
      currentAccount,
      isDynamicLoading,
      currentIsConnected,
      disconnectDynamicWallet,
      addNotification,
      dynamicAccount,
      connectWallet,
      disconnectWallet,
      walletType,
      isLoading,
      primaryWallet,
      isMobile = props.isMobile || appState.ui.isMobile
    } = props;
    
    const isLineraConnected = currentIsConnected && walletType === 'linera';
    const lineraAccount = isLineraConnected ? currentAccount : null;
    
    const handleConnectLineraWallet = async () => {
      try {
        if (!window.linera) {
          addNotification("Linera wallet not installed, please visit https://github.com/respeer-ai/linera-wallet to download and install", "warning");
          return;
        }
        if (currentIsConnected && walletType) {
          if (walletType === 'dynamic') {
            await props.disconnectDynamicWallet();
            addNotification('Dynamic wallet: disconnected', 'info');
            await new Promise(resolve => setTimeout(resolve, 500));
          } else if (walletType === 'linera') {
            await props.disconnectWallet();
            addNotification('Linera Wallet: Disconnected', 'success');
            return;
          }
        }
        
        await connectWallet('linera');
        addNotification('Linera wallet: connected', 'success');
      } catch (error) {
        addNotification(`Failed to connect Linera wallet: ${error.message}`, 'error');
      }
    };
    
    const handleDisconnectLineraWallet = async () => {
      try {
        await props.disconnectWallet();
        addNotification('Linera wallet: disconnected', 'success');
      } catch (error) {
        addNotification(`Failed to disconnect Linera wallet: ${error.message}`, 'error');
      }
    };
    
    const handleConnectDynamicWallet = async () => {
      try {
        if (isDynamicConnected || isActiveDynamicWallet) {
          await props.disconnectDynamicWallet();
          addNotification('Dynamic wallet: disconnected', 'success');
          return;
        }
        if (isLineraConnected) {
          await props.disconnectWallet();
          addNotification('Linera wallet disconnected', 'info');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!isDynamicConnected && !isActiveDynamicWallet) {
          await props.connectWallet('dynamic');
          addNotification('Dynamic wallet: connected', 'success');
        }
      } catch (error) {
        addNotification(`Failed to handle Dynamic wallet: ${error.message}`, 'error');
      }
    };
    
    const handleDisconnectDynamicWalletClick = async () => {
      try {
        await props.disconnectDynamicWallet();
        addNotification('Dynamic wallet: disconnected', 'success');
      } catch (error) {
        addNotification(`Failed to disconnect Dynamic wallet: ${error.message}`, 'error');
      }
    };
    
    return (
      <div className="flex items-center gap-3">
        <div>
          {isLineraConnected ? (
            <div 
              className="px-3.5 py-1.5 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center cursor-pointer transition-all duration-200 hover:opacity-80"
              onClick={handleDisconnectLineraWallet}
              title="Click to disconnect Linera wallet"
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-lg"></span>
                {lineraAccount ? `${lineraAccount.slice(0, 6)}...${lineraAccount.slice(-4)}` : 
                 currentAccount ? `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}` : 'Connected'}
              </div>
            </div>
          ) : (
            <button 
              className={`px-3.5 py-1.5 font-semibold text-xs rounded-md cursor-pointer transition-all duration-200 min-w-[110px] ${BUTTON_STYLES.primary} border-none rounded-lg shadow-md transition-all duration-300 hover:transform hover:-translate-y-0.5 hover:shadow-lg active:transform active:translate-y-0 active:transition-transform active:duration-100`}
              onClick={handleConnectLineraWallet}
              disabled={isLoading && walletType === 'linera'}
            >
              {isLoading && walletType === 'linera' ? "Connecting..." : 'Linera Wallet'}
            </button>
          )}
        </div>
        
        <div>
          {(primaryWallet && primaryWallet.address) || (currentIsConnected && currentAccount && walletType !== 'linera') ? (
            <div 
              className="px-3.5 py-1.5 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center cursor-pointer transition-all duration-200 hover:opacity-80"
              onClick={handleDisconnectDynamicWalletClick}
              title="Click to disconnect wallet"
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-lg"></span>
                {primaryWallet?.address ? `${formatAccountOwner(primaryWallet.address).slice(0, 6)}...${formatAccountOwner(primaryWallet.address).slice(-4)}` : 
                 currentAccount ? `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}` : 
                 'Connected'}
              </div>
            </div>
          ) : (
            <div>
              <DynamicConnectButton>
                <button 
              className={`px-3.5 py-1.5 font-semibold text-xs rounded-md cursor-pointer transition-all duration-200 min-w-[110px] ${BUTTON_STYLES.secondary} hover:transform hover:-translate-y-0.5`}
            >
                  Dynamic Wallet
                </button>
              </DynamicConnectButton>
            </div>
          )}
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    if (prevProps.showLeaderboard !== nextProps.showLeaderboard) {
      return false;
    }
    const prevLeaderboardData = prevProps.leaderboardData?.getTopUsers;
    const nextLeaderboardData = nextProps.leaderboardData?.getTopUsers;
    
    if (prevLeaderboardData?.length !== nextLeaderboardData?.length) {
      return false;
    }
    if (prevLeaderboardData && nextLeaderboardData) {
      for (let i = 0; i < prevLeaderboardData.length; i++) {
        if (prevLeaderboardData[i]?.count !== nextLeaderboardData[i]?.count || 
            prevLeaderboardData[i]?.user !== nextLeaderboardData[i]?.user) {
          return false;
        }
      }
    }
    const prevInvitationData = prevProps.invitationLeaderboardData?.getTopInvitors;
    const nextInvitationData = nextProps.invitationLeaderboardData?.getTopInvitors;
    
    if (prevInvitationData?.length !== nextInvitationData?.length) {
      return false;
    }
    if (prevInvitationData && nextInvitationData) {
      for (let i = 0; i < prevInvitationData.length; i++) {
        if (prevInvitationData[i]?.count !== nextInvitationData[i]?.count || 
            prevInvitationData[i]?.user !== nextInvitationData[i]?.user) {
          return false;
        }
      }
    }
    if (prevProps.currentAccount !== nextProps.currentAccount) {
      return false;
    }
    if (prevProps.isMobile !== nextProps.isMobile) {
      return false;
    }
    return true;
  });
  
  const setMessage = useCallback((message, type = 'error') => {
    addNotification(message, type);
  }, [addNotification]);
  
  const copyToClipboard = useCallback((text, event) => {
    const copyText = async (textToCopy) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          return Promise.resolve();
        } catch (err) {
          return fallbackCopyToClipboard(textToCopy);
        }
      } else {
        return fallbackCopyToClipboard(textToCopy);
      }
    };
    
    const fallbackCopyToClipboard = (textToCopy) => {
      return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (!successful) {
            throw new Error('Copy command failed');
          }
          resolve();
        } catch (err) {
          document.body.removeChild(textArea);
          alert(`Cannot copy address automatically, please copy manually: ${textToCopy}`);
          reject(err);
        }
      });
    };
    
    copyText(text).then(() => {
      const element = event.target;
      const originalHTML = element.innerHTML;
      const originalClasses = element.className;
      
      element.innerHTML = '<span class="text-red-600 font-bold">Copied!</span>';
      
      setTimeout(() => {
        element.innerHTML = originalHTML;
        element.className = originalClasses;
      }, 1000);
    }).catch((err) => {
    });
  }, []);

  const copyReferralLink = useCallback(() => {
    if (!memoizedCurrentAccount) {

      alert('Please connect your wallet first');
      return;
    }
    const referralLink = `${window.location.origin}?inviter=${memoizedCurrentAccount}`;
    copyToClipboard(referralLink);
    
    setCopySuccess(true);
    
    setTimeout(() => {
      setCopySuccess(false);
    }, 3000);
  }, [memoizedCurrentAccount, copyToClipboard]);

  const handleMutationComplete = useCallback((data, mutationType) => {
    if (mutationType === 'invitation') {
      setClaimStatus("success");
      setTimeout(() => setClaimStatus(null), 5000);
    } else {
      setOperationStatus("success");
      setTimeout(() => setOperationStatus(null), 5000);
    }
    
    let successMessage = "Operation completed successfully!";
    if (mutationType === 'sendGM') {
      successMessage = "GMicrochains sent successfully!";
    } else if (mutationType === 'setCooldown') {
      successMessage = "24-hour limit updated successfully!";
    } else if (mutationType === 'invitation') {
      successMessage = "Invitation operation completed successfully!";
    } else if (mutationType === 'setUserProfile') {
      return;
    }
    
    addNotification(successMessage, "success");
    
    setTimeout(() => {
      if (gmOps) {
        gmOps.refetchWalletMessages && gmOps.refetchWalletMessages();
        gmOps.refetchInvitationStats && gmOps.refetchInvitationStats();
        
        if (mutationType === 'sendGM') {
          previousEventCountRef.current = 0;
          gmOps.refetchStreamEvents && gmOps.refetchStreamEvents();
          gmOps.refetch && gmOps.refetch({ fetchPolicy: 'network-only' });
          gmOps.refetchWalletMessages && gmOps.refetchWalletMessages({ fetchPolicy: 'network-only' });
        }
      }
      
      if (additionalData) {
        additionalData.refetchGmRecord && additionalData.refetchGmRecord();
      }
    }, 1000);
  }, [addNotification]);

  const leaderboardData = useLeaderboardData();
  const cooldownData = useCooldownData({
    currentAccount,
    queryRetryCount,
    setQueryRetryCount
  });
  const userData = useUserData({
    chainId,
    currentAccount,
    queryRetryCount,
    setQueryRetryCount
  });
  const additionalData = useGMAdditionalData({
    chainId,
    currentAccount,
    currentChainId: connectedWalletChainId,
    walletType,
    queryRetryCount,
    setQueryRetryCount,
    currentIsConnected
  });
  const stableLeaderboardData = useMemo(() => ({
    getTopUsers: [...(leaderboardData.leaderboardData?.getTopUsers || [])]
  }), [JSON.stringify(leaderboardData.leaderboardData?.getTopUsers)]);

  const stableInvitationLeaderboardData = useMemo(() => ({
    getTopInvitors: [...(leaderboardData.invitationLeaderboardData?.getTopInvitors || [])]
  }), [JSON.stringify(leaderboardData.invitationLeaderboardData?.getTopInvitors)]);
  const stableRefetchLeaderboard = useCallback(() => {
    leaderboardData.refetchLeaderboard && leaderboardData.refetchLeaderboard();
  }, [leaderboardData.refetchLeaderboard]);

  const stableRefetchInvitationLeaderboard = useCallback(() => {
    leaderboardData.refetchInvitationLeaderboard && leaderboardData.refetchInvitationLeaderboard();
  }, [leaderboardData.refetchInvitationLeaderboard]);
  const memoizedLeaderboardData = useMemo(() => leaderboardData.leaderboardData, [leaderboardData.leaderboardData]);
  const shareModalAdditionalData = userData;

  useEffect(() => {
    if (activeTab === 'leaderboards') {
      stableRefetchLeaderboard();
      stableRefetchInvitationLeaderboard();
    }
  }, [activeTab, stableRefetchLeaderboard, stableRefetchInvitationLeaderboard]);
  const gmOperationsResult = GMOperations({
    chainId,
    currentAccount,
    currentChainId: connectedWalletChainId,
    walletMode: walletType,
    targetChainId,
    appId,
    ownerId,
    addNotification,
    setMessage,
    setOperationStatus,
    setClaimStatus,
    onMutationComplete: handleMutationComplete,
    onMutationError: (error) => {

      setOperationStatus("error");
      setTimeout(() => setOperationStatus(null), 5000);
      addNotification(`Operation failed: ${error.message}`, "error");
    },
    inviter,
    queryRetryCount,
    setQueryRetryCount,
    currentIsConnected,
    customMessage,
    customMessageEnabled,
    currentChatPartner
  }) || {};
  const gmOps = {
    walletMessagesData: { walletMessages: null },
    subscriptionStatus: {},
    streamEventsData: [],
    gmEventsData: {},
    loading: false,
    error: null,
    data: { totalMessages: 0 },
    queryError: null,
    invitationStatsData: {
      totalInvited: 0,
      totalRewards: 0,
      lastRewardTime: null
    },
    refetchInvitationRewards: () => Promise.resolve({}),
    refetchLeaderboard: () => Promise.resolve({}),
    refetchGmEvents: () => Promise.resolve({}),
    refetchWalletMessages: () => Promise.resolve({}),
    refetchInvitationStats: () => Promise.resolve({}),
    refetchStreamEvents: () => Promise.resolve({}),
    handleSendGM: () => Promise.resolve({}),
    handleSendGMToWithAddress: () => Promise.resolve({}),
    handleSendGMWithInvitation: () => Promise.resolve({}),
    handleClaimInvitationRewards: () => Promise.resolve({}),
    handleSetCooldownEnabled: () => Promise.resolve({}),
    isValidAccountOwner: () => false,
    formatCooldown: (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`,
    validateRecipientAddress: () => ({ isValid: false, error: '' }),
    formatAccountOwner: (address) => address || '',
    ...gmOperationsResult
  };
  useEffect(() => {
    if (showShareReferralModal && memoizedCurrentAccount && shareModalAdditionalData?.refetchInvitationStats) {
      shareModalAdditionalData.refetchInvitationStats();
    }
  }, [showShareReferralModal, memoizedCurrentAccount, shareModalAdditionalData?.refetchInvitationStats]);

  const handleHistoryToggle = useCallback(async () => {
    if (showHistoryDropdown) {
      setShowHistoryDropdown(false);
      return;
    }
    
    if (!currentIsConnected || !currentAccount) {
      addNotification('Please connect your wallet first to view chat history', 'info');
      const walletSection = document.querySelector('.wallet-connection-section');
      if (walletSection) {
        walletSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    
    try {
      setHistoryLoading(true);
      
      const [sentData, receivedData] = await Promise.all([
        gmOps.refetchGmEvents(),
        gmOps.refetchReceivedGmEvents()
      ]);
      
      const sentEvents = sentData.data?.getGmEvents || [];
      const receivedEvents = receivedData.data?.getReceivedGmEvents || [];
      

      
      const allEvents = [...sentEvents, ...receivedEvents];
      
      if (allEvents.length > 0) {
        const sortedRecords = allEvents.sort((a, b) => 
          parseInt(b.timestamp) - parseInt(a.timestamp)
        );
        
        setHistoryRecords(sortedRecords.slice(0, 15));
      } else {
        setHistoryRecords([]);
      }
    } catch (error) {

      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
      setShowHistoryDropdown(true);
    }
  }, [showHistoryDropdown, currentAccount, gmOps]);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showContactList && 
          !event.target.closest('.contact-selector') && 
          !event.target.closest('.contact-dropdown') &&
          !event.target.closest('input') &&
          !event.target.closest('button')) {
        setShowContactList(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContactList]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showHistoryDropdown && 
          !event.target.closest('.send-action-card') && 
          !event.target.closest('.history-button') &&
          !event.target.closest('.history-dropdown')) {
        setShowHistoryDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHistoryDropdown]);
  const {
    gmRecordData,
    refetchCooldownStatus,
    refetchCooldownCheck,
    refetchGmRecord
  } = additionalData;

  const handleToggleCooldown = useCallback(async (enabled) => {
    if (!gmOps.isValidAccountOwner(currentAccount)) {
      setMessage("Invalid account address", "error");
      return;
    }

    setOperationStatus("processing");
    
    try {
      setLocalCooldownEnabled(enabled);
      
      if (enabled && gmRecordData?.getGmRecord?.timestamp) {
        const COOLDOWN_MS = 86_400_000;
        const timestamp = Number(gmRecordData.getGmRecord.timestamp);
        let lastGm;
        if (timestamp > 1e12) {
          lastGm = timestamp / 1000;
        } else if (timestamp > 1e9) {
          lastGm = timestamp * 1000;
        } else {
          lastGm = timestamp;
        }
        
        const currentTs = Date.now();
        if (currentTs < lastGm + COOLDOWN_MS) {
          setCooldownRemaining(lastGm + COOLDOWN_MS - currentTs);
        } else {
          setCooldownRemaining(0);
        }
      } else {
        setCooldownRemaining(0);
      }
      await gmOps.handleSetCooldownEnabled(enabled);
      await (refetchCooldownStatus && refetchCooldownStatus({ fetchPolicy: 'network-only' }));
      await (refetchCooldownCheck && refetchCooldownCheck({ fetchPolicy: 'network-only' }));
      await (refetchGmRecord && refetchGmRecord({ fetchPolicy: 'network-only' }));
      
      setOperationStatus("success");
      setTimeout(() => setOperationStatus(null), 3000);
    } catch (error) {
      setLocalCooldownEnabled(!enabled);
      setCooldownRemaining(0);
      
      addNotification(
        `Failed to ${enabled ? 'enable' : 'disable'} 24-hour limit: ${error.message}`,
        "error"
      );
      setOperationStatus("error");
    }
  }, [currentAccount, setMessage, addNotification, gmOps, gmRecordData, refetchCooldownStatus, refetchCooldownCheck, refetchGmRecord]);
 
  useEffect(() => {
    if (currentAccount && currentChainId) {
      const syncCooldownStatus = () => {
        if (additionalData?.refetchCooldownStatus) {
          additionalData.refetchCooldownStatus().then((res) => {
            const currentCooldownStatus = res?.data?.getCooldownStatus?.enabled ?? additionalData.cooldownStatusData?.getCooldownStatus?.enabled;
            if (typeof currentCooldownStatus === 'boolean') {
              setLocalCooldownEnabled(currentCooldownStatus);
              console.log('Syncing 24-hour limit status:', currentCooldownStatus ? 'ENABLED' : 'DISABLED');
            }
          }).catch(error => {
            const cachedCooldownStatus = additionalData.cooldownStatusData?.getCooldownStatus?.enabled;
            if (typeof cachedCooldownStatus === 'boolean') {
              setLocalCooldownEnabled(cachedCooldownStatus);
            }
          });
        }
      };

      syncCooldownStatus();
    }
  }, [currentAccount, currentChainId]);

  useEffect(() => {
    const handleUpdateInvitedUsers = (event) => {
      const { invitedUsers } = event.detail;
      setInvitedUsers(invitedUsers);
      setInvitedUsersLoading(false);
    };

    const handleToggleDropdown = () => {
      setInvitedUsersLoading(true);
    };

    window.addEventListener('updateInvitedUsersDropdown', handleUpdateInvitedUsers);
    window.addEventListener('toggleInvitedUsersDropdown', handleToggleDropdown);
    
      const handleClickOutsideDropdown = (event) => {
      const rewardSection = event.target.closest('.reward-section');
      const dropdownMenu = document.querySelector('.invitation-sender')?.closest('div[class*="absolute"]');
      
      if (!rewardSection && !dropdownMenu) {
        setShowInvitedUsersDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutsideDropdown);

    return () => {
      window.removeEventListener('updateInvitedUsersDropdown', handleUpdateInvitedUsers);
      window.removeEventListener('toggleInvitedUsersDropdown', handleToggleDropdown);
      document.removeEventListener('click', handleClickOutsideDropdown);
    };
  }, []);

  const processedEventsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  
  useEffect(() => {
    const streamEvents = gmOps.streamEventsData || [];
    const gmEvents = gmOps.gmEventsData || [];

    const allEvents = streamEvents;
    
    if (allEvents.length > 0) {
      const eventIds = allEvents.map(event => 
        `${event.sender}-${event.recipient}-${event.timestamp}`
      );
      
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        
        eventIds.forEach(eventId => {
          processedEventsRef.current.add(eventId);
        });
        
        setTimeout(() => {
          const initialRecords = allEvents.map(event => ({
            sender: event.sender,
            recipient: event.recipient,
            timestamp: event.timestamp,
            content: event.content || 'Gmicrochains'
          }));
          setGmRecords(initialRecords);
        }, 100);
      } else {
        const newEvents = allEvents.filter((event, index) => {
          const eventId = eventIds[index];
          const isProcessed = processedEventsRef.current.has(eventId);
          
          return !isProcessed;
        });
        
        if (newEvents.length > 0) {
          newEvents.forEach((event, index) => {
            const eventIndex = allEvents.indexOf(event);
            const eventId = eventIds[eventIndex];
            processedEventsRef.current.add(eventId);
          });
          
          const newRecords = newEvents.map(event => ({
            sender: event.sender,
            recipient: event.recipient,
            timestamp: event.timestamp,
            content: event.content || 'Gmicrochains'
          }));
          
          setGmRecords(prev => {
            const existingTimestamps = new Set(prev.map(r => r.timestamp));
            const filteredNewRecords = newRecords.filter(r => !existingTimestamps.has(r.timestamp));
            
            if (filteredNewRecords.length > 0) {
              return [...prev, ...filteredNewRecords];
            } else {
              return prev;
            }
          });
        }
      }
    }
  }, [gmOps.streamEventsData, gmRecords.length]);

  useEffect(() => {
    if (gmOps.subscriptionStatus?.gmEvents?.lastUpdate) {
      const refreshTimeout = setTimeout(() => {
        console.groupCollapsed('[cause] subscription-update');
        if (gmOps.refetchGmEvents) {
          gmOps.refetchGmEvents();
        }
        console.groupEnd();
      }, 30000);
      
      return () => clearTimeout(refreshTimeout);
    }
  }, [gmOps.subscriptionStatus?.gmEvents?.lastUpdate, gmOps.refetchGmEvents]);

  useEffect(() => {
    if (gmOps.subscriptionStatus?.gmEvents?.lastUpdate) {
      const refreshTimeout = setTimeout(() => {
        console.groupCollapsed('[cause] subscription-event-received');
        if (additionalData.refetchCooldownStatus) {
          additionalData.refetchCooldownStatus({
            fetchPolicy: 'network-only',
            nextFetchPolicy: 'cache-first'
          });
        }
        if (additionalData.refetchGmRecord) {
          additionalData.refetchGmRecord({
            fetchPolicy: 'network-only',
            nextFetchPolicy: 'cache-and-network'
          });
        }
        console.groupEnd();
      }, 1000);
      
      return () => clearTimeout(refreshTimeout);
    }
  }, [gmOps.subscriptionStatus?.gmEvents?.lastUpdate, additionalData.refetchCooldownStatus, additionalData.refetchGmRecord]);

  const [lastProcessedSubscriptionTime, setLastProcessedSubscriptionTime] = useState(null);
  
  useEffect(() => {
    const isCooldownEnabled = additionalData.cooldownStatusData?.getCooldownStatus?.enabled;
    setLocalCooldownEnabled(!!isCooldownEnabled);
  }, [additionalData.cooldownStatusData]);
  
  useEffect(() => {
    const COOLDOWN_MS = 86_400_000;
    
    const calculateCooldownRemaining = () => {
      const hasValidTimestamp = additionalData.gmRecordData?.getGmRecord?.timestamp;
      
      if (localCooldownEnabled && hasValidTimestamp) {
        const timestamp = Number(additionalData.gmRecordData.getGmRecord.timestamp);
        let lastGm;
        if (timestamp > 1e12) {
          lastGm = timestamp / 1000;
        } else if (timestamp > 1e9) {
          lastGm = timestamp * 1000;
        } else {
          lastGm = timestamp;
        }
        
        const currentTs = Date.now();
        if (currentTs < lastGm + COOLDOWN_MS) {
          return lastGm + COOLDOWN_MS - currentTs;
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    };
    
    setCooldownRemaining(calculateCooldownRemaining());
    
    let intervalId;
    if (localCooldownEnabled) {
      intervalId = setInterval(() => {
        const remaining = calculateCooldownRemaining();
        setCooldownRemaining(remaining);
        
        if (remaining <= 0) {
          clearInterval(intervalId);
        }
      }, 1000);
    } else {
      setCooldownRemaining(0);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [additionalData.gmRecordData, localCooldownEnabled]);

  const isManualTargetChainChange = useRef(false);
  
  useEffect(() => {
    if (targetChainId && isManualTargetChainChange.current) {
      localStorage.setItem('targetChainId', targetChainId);
      isManualTargetChainChange.current = false;
    }
  }, [targetChainId]);



  const countdown = gmOps.formatCooldown(cooldownRemaining, true);

  const handleSendGMWithInvitation = useCallback(() => {
    const content = customMessageEnabled ? customMessage : "Gmicrochains";
    const inviter = urlInviter;
    gmOps.handleSendGMWithInvitation(content, inviter);
  }, [gmOps, customMessageEnabled, customMessage, urlInviter]);

  const handleClaimInvitationRewards = useCallback(() => {
    gmOps.handleClaimInvitationRewards();
  }, [gmOps]);

  const handleSendGM = useCallback(async (messageType = "text", contentUrl = null, voiceFile = null) => {

    if (isSendingMessage) {
      return;
    }
    
    if (!currentIsConnected) {
      if (window.linera) {
        connectWallet('linera');
        addNotification('Connecting Linera wallet...', 'info');
      } else {
        addNotification('Please connect your wallet first using the wallet connection buttons above', 'info');
        const walletSection = document.querySelector('.wallet-connection-section');
        if (walletSection) {
          walletSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }
    
    if (currentAccount && !gmOps.isValidAccountOwner(currentAccount)) {
      addNotification('Your wallet：connection', 'error');
      return;
    }
    
    let formattedRecipient = null;

    if (recipientAddress && recipientAddress.trim() !== '') {
      formattedRecipient = gmOps.formatAccountOwner(recipientAddress);

      const validation = gmOps.validateRecipientAddress(formattedRecipient);

      if (!validation.isValid) {
        addNotification(validation.error, 'error');

        return;
      }
    } else {

    }
    
    let messageContent = customMessageEnabled ? customMessage : null;
    
    if (messageType === "gif") {
      if (contentUrl) {
        messageContent = contentUrl;

      } else if (selectedGif) {
        messageContent = selectedGif;

      }
    } else if (messageType === "voice") {
      if (contentUrl) {
        messageContent = contentUrl;

      } else if (voiceFile) {
        try {
          const timestamp = Date.now();
          const filename = `voice-${timestamp}-${currentAccount ? currentAccount.substring(2, 10) : 'user'}.${voiceFile.name.split('.').pop()}`;
          
          const result = await uploadToPinata(voiceFile, filename);
          
          if (result && result.success && result.url) {
            messageContent = result.url;
          } else {
            throw new Error('Voice upload failed');
          }
        } catch (error) {
          console.error('Voice upload error:', error);
          addNotification('Failed to upload voice message', 'error');
          setIsSendingMessage(false);
          return;
        }
      } else {
        messageContent = '🎤 Voice Message';

      }
    }   

    setIsSendingMessage(true);
    
    try {
      await gmOps.handleSendGM(messageContent, formattedRecipient, urlInviter, messageType);

    } finally {

      setIsSendingMessage(false);
    }
    
    if (messageType === "gif") {
      setSelectedGif('');
    }

    if (messageType === 'text' && customMessageEnabled && customMessage.trim() !== '') {
      setCustomMessage('');
    }
    
    setTimeout(() => {
      if (additionalData.refetchCooldownStatus) {
        additionalData.refetchCooldownStatus();
      }
      if (additionalData.refetchGmRecord) {
        additionalData.refetchGmRecord();
      }
      if (additionalData.refetchCooldownCheck) {
        additionalData.refetchCooldownCheck();
      }
      if (gmOps.refetchWalletMessages) {
        gmOps.refetchWalletMessages();
      }
    }, 1000);
  }, [currentIsConnected, connectWallet, gmOps, addNotification, customMessageEnabled, customMessage, selectedGif, additionalData, recipientAddress, setAddressValidationError, urlInviter, isSendingMessage]);

  const handleGifSelect = useCallback((gifUrl, gmOperations) => {

    setSelectedGif(gifUrl);
    setShowGifPicker(false);
    
    if (!currentIsConnected) {
      addNotification('Please connect your wallet first', 'error');
      setSelectedGif('');
      return;
    }


    if (currentAccount && gmOperations?.isValidAccountOwner(currentAccount)) {

      handleSendGM("gif", gifUrl);
    } else if (currentIsConnected) {

      handleSendGM("gif", gifUrl);
    } else {

      addNotification('Invalid wallet account format', 'error');
      setSelectedGif('');
    }
  }, [currentAccount, currentIsConnected, addNotification, recipientAddress, currentChatPartner]);



  const uploadFileToCloud = async (file) => {

    if (!file || !(file instanceof File)) {
      console.error('Invalid file object, expected File:', file);
      return null;
    }
    
    if (!file.name) {
      console.error('File has no name property:', file);
      return null;
    }
    
    try {
      setUploading(true);
      
      const timestamp = Date.now();
      const filename = `avatar-${timestamp}-${currentAccount ? currentAccount.substring(2, 10) : 'user'}.${file.name.split('.').pop()}`;
      
      const result = await uploadToPinata(file, filename);
      
      if (result && result.success && result.url) {
        return result.url;
      } else {
        throw new Error('Avatar upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      addNotification('Failed to upload avatar', 'error');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditAvatar(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateUsername = (username) => {
    if (!username || username.trim() === '') {
      return { isValid: false, error: 'Username cannot be empty' };
    }
    
    if (username.length < 1 || username.length > 20) {
      return { isValid: false, error: 'Username must be 1-20 characters long' };
    }
    
    const validPattern = /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/;
    if (!validPattern.test(username)) {
      return { isValid: false, error: 'Username can only contain letters, numbers, underscores, hyphens, and Chinese characters' };
    }
    
    return { isValid: true, error: '' };
  };

  const handleSaveProfile = async () => {
    try {
      setProfileSaveStatus(null);
      setProfileSaveMessage("");
      
      const validation = validateUsername(editUsername || userProfile?.username || '');
      if (!validation.isValid) {
        setProfileSaveStatus('error');
        setProfileSaveMessage(validation.error);
        addNotification(validation.error, 'error');
        return;
      }
      
      let avatarUrl = userProfile?.avatar;
      
      if (editAvatar) {
        if (editAvatar instanceof File) {
          const uploadedUrl = await uploadFileToCloud(editAvatar);
          if (uploadedUrl) {
            avatarUrl = uploadedUrl;
          } else {
            addNotification('Avatar upload failed, keeping previous avatar', 'warning');
          }
        } else if (typeof editAvatar === 'string' && editAvatar.startsWith('http')) {
          avatarUrl = editAvatar.trim().replace(/^`+|`+$/g, '').trim();
        }
      }
      
      const updatedProfile = {
        username: editUsername || userProfile?.username || '',
        avatar: avatarUrl || ''
      };
      
      if (currentAccount) {
        localStorage.setItem(`userProfile_${currentAccount}`, JSON.stringify(updatedProfile));
      }
      
      setUserProfile(updatedProfile);
      
      if (gmOps?.handleSetUserProfile && currentAccount) {
        const result = await gmOps.handleSetUserProfile(
          editUsername || userProfile?.username || '',
          avatarUrl || ''
        );
        
        const success = result !== null && result !== undefined;
        const message = 'Profile updated successfully!';
        
        if (success) {
          setProfileSaveStatus('success');
          setProfileSaveMessage(message);
          addNotification(message, 'success');
        } else {
          const errorMessage = 'Failed to update profile';
          setProfileSaveStatus('error');
          setProfileSaveMessage(errorMessage);
          addNotification(errorMessage, 'error');
        }
      } else {
        setProfileSaveStatus('success');
        setProfileSaveMessage('Profile updated successfully!');
        addNotification('Profile updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setProfileSaveStatus('error');
      setProfileSaveMessage('Failed to update profile: ' + error.message);
      addNotification('Failed to update profile', 'error');
    }
  };

  const handleCancelProfileEdit = () => {
    setShowProfileSettings(false);
    setAvatarPreview('');
    setSelectedAvatarFile(null);
    setProfileSaveStatus(null);
    setProfileSaveMessage("");
  };

  return (
    <ErrorBoundary>
      <div>
        {showProfileSettings && (
          <div className={`${MODAL_STYLES.overlay}`}>
            <div className={`${MODAL_STYLES.content} p-6 w-full max-w-md`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`${TEXT_STYLES.title}`}>Edit Profile</h3>
                <button className="text-gray-500 hover:text-gray-700 text-2xl cursor-pointer" onClick={handleCancelProfileEdit}>×</button>
              </div>
              
              {profileSaveStatus && profileSaveMessage && (
                <div className={`p-3 rounded-md mb-4 ${profileSaveStatus === 'success' ? NOTIFICATION_STYLES.success : NOTIFICATION_STYLES.error}`}>
                  {profileSaveMessage}
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Username:</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Enter username"
                  maxLength={20}
                  className={`${INPUT_STYLES.base} focus:ring-blue-500`}
                />
              </div>
              <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo:</label>
                  <div className="flex flex-col items-center gap-3">
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: 'none' }}
                    />
                    <div 
                      className="w-32 h-32 rounded-full border-2 border-gray-200 overflow-hidden flex items-center justify-center bg-gray-800 cursor-pointer"
                      onClick={() => document.getElementById('avatar-upload').click()}
                    >
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : editAvatar ? (
                        <img src={editAvatar} alt="Current avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">No photo</div>
                      )}
                    </div>
                    <button type="button" onClick={() => document.getElementById('avatar-upload').click()} className={`${BUTTON_STYLES.secondary} px-4 py-2 rounded-md`}>
                      Upload Photo
                    </button>
                  </div>
                </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleSaveProfile} disabled={uploading} className={`${BUTTON_STYLES.secondary} px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed`}>
                  {uploading ? 'Uploading...' : 'Save'}
                </button>
                <button onClick={handleCancelProfileEdit} disabled={uploading} className={`${BUTTON_STYLES.outline} px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed`}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        <button 
          className="fixed right-3 bottom-[calc(100vh-320px-4rem)] bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-none rounded-lg px-2 py-3 text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-500/30 z-50 transition-all duration-300 flex items-center justify-center whitespace-nowrap transform rotate-90 hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105"
          onClick={handleToggleShareReferral}
          title="Share your referral link"
        >
          🔗 Share Referral
        </button>
        {showShareReferralModal && (
          <div className={`${MODAL_STYLES.overlay} bg-black/70 z-[1001] animate-fadeIn`} onClick={handleToggleShareReferral}>
            <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] w-9/10 max-w-[500px] max-h-[80vh] overflow-y-auto animate-slideUp" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 border-b border-gray-200">
                <h3 className={`m-0 ${TEXT_STYLES.title}`}>Share Your Referral Link ✨</h3>
                <button className="bg-none border-none text-[28px] cursor-pointer text-gray-500 p-0 w-[30px] h-[30px] flex items-center justify-center rounded-full transition-all duration-200 hover:bg-gray-100 hover:text-gray-900" onClick={handleToggleShareReferral}>×</button>
              </div>
              <div className="p-4">
                {memoizedCurrentAccount && (
                  <>
                    <div className="bg-gray-50 rounded-xl p-2 mb-3 shadow-sm">
                      <button 
                        className={`${BUTTON_STYLES.outline} px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 shadow-sm`}
                        onClick={() => shareModalAdditionalData?.refetchInvitationStats && shareModalAdditionalData.refetchInvitationStats()}
                        title="Refresh invitation stats"
                      >
                        🔄 Refresh
                      </button>
                      <div className="mt-2">
                        <div className="relative flex justify-between items-center py-1">
                          <div 
                            onClick={() => {
                              if (!shareModalAdditionalData?.invitationStatsData?.totalInvited || !currentAccount) return;
                              const event = new CustomEvent('toggleInvitedUsersDropdown', {
                                detail: { userId: currentAccount }
                              });
                              window.dispatchEvent(event);
                              setShowInvitedUsersDropdown(!showInvitedUsersDropdown);
                            }}
                            style={{ cursor: shareModalAdditionalData?.invitationStatsData?.totalInvited > 0 ? 'pointer' : 'default' }}
                          >
                            <span className="text-sm text-gray-500">Invited Users: {showInvitedUsersDropdown ? '▲' : '▼'}</span>
                          </div>
                          <span className="text-base font-semibold text-red-500">{(() => {
                            try {
                              return Number(shareModalAdditionalData?.invitationStatsData?.totalInvited) || 0;
                            } catch (error) {
                              return 0;
                            }
                          })()}</span>
                          <div className={`absolute right-0 top-full mt-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-full max-w-[calc(100vw-4rem)] ${showInvitedUsersDropdown ? 'block' : 'hidden'}`}>
                            {invitedUsersLoading ? (
                              <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
                            ) : invitedUsers.length > 0 ? (
                              <div>
                                {invitedUsers.map((user, index) => (
                                  <div key={index} className="px-4 py-2 text-sm hover:bg-gray-50">
                                    <div className="invitation-sender">
                                      {`${user.invitee.slice(0, 6)}...${user.invitee.slice(-4)}`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="px-4 py-2 text-sm text-gray-500">No invited users found</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1 border-t border-gray-200">
                        <span className="text-sm text-gray-500">Your Reward Points:</span>
                        <span className="text-base font-semibold text-red-500">{(() => {
                          try {
                            return Number(shareModalAdditionalData?.invitationStatsData?.totalRewards) || 0;
                          } catch (error) {
                            return 0;
                          }
                        })()}</span>
                      </div>
                      {(() => {
                        try {
                          const lastRewardTime = shareModalAdditionalData?.invitationStatsData?.lastRewardTime;
                          return lastRewardTime ? (
                            <div className="flex justify-between items-center py-1 border-t border-gray-200">
                              <span className="text-sm text-gray-500">Last Reward:</span>
                              <span className="text-sm font-semibold text-red-500">{new Date(Number(lastRewardTime) / 1000).toLocaleString()}</span>
                            </div>
                          ) : null;
                        } catch (error) {
                          return null;
                        }
                      })()}
                    </div>
                    <div className="mb-3">
                      <label className="block mb-1 text-sm font-semibold text-gray-900">Your Referral Link:</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={`${window.location.origin}?inviter=${memoizedCurrentAccount}`}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 shadow-sm"
                        />
                        <button 
                          className={`${BUTTON_STYLES.primary} border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all duration-200 shadow-md shadow-red-500/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none ${copySuccess ? 'copy-success' : ''}`}
                          onClick={copyReferralLink}
                        >
                          {copySuccess ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-900 mb-1">Share directly:</p>
                      <div className="grid grid-cols-2 gap-3">
                        <a 
                          href={`https://twitter.com/intent/tweet?text=Join%20GMicrochains%20and%20use%20my%20referral%20link!&url=${encodeURIComponent(window.location.origin + '?inviter=' + memoizedCurrentAccount)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${BUTTON_STYLES.secondary} border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all duration-200 shadow-md shadow-[#1DA1F2]/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1DA1F2]/30 active:translate-y-0 active:scale-98 inline-block text-center disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:transform-none`}
                        >
                          🐦 Twitter
                        </a>
                        <a 
                          href={`https://t.me/share/url?url=${encodeURIComponent(window.location.origin + '?inviter=' + memoizedCurrentAccount)}&text=Join%20GMicrochains%20and%20use%20my%20referral%20link!`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${BUTTON_STYLES.secondary} border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all duration-200 shadow-md shadow-[#2CA5E0]/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#2CA5E0]/30 active:translate-y-0 active:scale-98 inline-block text-center disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:transform-none`}
                        >
                          📱 Telegram
                        </a>
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs leading-relaxed text-gray-600 shadow-sm">
                      <p className="mb-2">🎁 <strong>Invite a user to send their first GMIC → 30 points</strong></p>
                      <p>🎯 <strong>Each GMIC they send after → +10 points</strong></p>
                    </div>
                  </>
                )}
                {!memoizedCurrentAccount && (
                  <div className="no-wallet-message">
                    <p>Please connect your wallet to access your referral link</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <header className={`${HEADER_STYLES.base}`}>
          <div className={`${HEADER_STYLES.container}`}>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <img src="/GMic.png" alt="GMIC Logo" className="w-[70px] h-auto object-contain" />
              </div>
              <nav className="flex gap-6 items-center">
                <button 
                  className={`${NAVIGATION_STYLES.tab} ${activeTab === 'messages' ? NAVIGATION_STYLES.active : NAVIGATION_STYLES.inactive}`}
                  onClick={() => setActiveTab('messages')}
                >
                  Messages
                </button>
                <button 
                  className={`${NAVIGATION_STYLES.tab} ${activeTab === 'leaderboards' ? NAVIGATION_STYLES.active : NAVIGATION_STYLES.inactive}`}
                  onClick={() => {
                    setActiveTab('leaderboards');
                    setShowLeaderboard(true);
                    setTimeout(() => {
                      const shouldRefetch = (
                        !additionalData.leaderboardData?.getTopUsers || 
                        additionalData.leaderboardData.getTopUsers.length === 0 ||
                        (additionalData.leaderboardData && !additionalData.leaderboardData.getTopUsers) ||
                        additionalData.leaderboardError
                      );
                      
                      if (shouldRefetch && additionalData.refetchLeaderboard) {
                        additionalData.refetchLeaderboard();
                      }
                      if (additionalData.refetchInvitationLeaderboard) {
                        additionalData.refetchInvitationLeaderboard();
                      }
                    }, 0);
                  }}
                >
                  Leaderboards
                </button>
                <button 
                  className={`${NAVIGATION_STYLES.tab} ${activeTab === 'settings' ? NAVIGATION_STYLES.active : NAVIGATION_STYLES.inactive}`}
                  onClick={() => setActiveTab('settings')}
                >
                  Settings
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <WalletConnectionSection 
                isDynamicConnected={isDynamicConnected}
                isActiveDynamicWallet={isActiveDynamicWallet}
                currentAccount={currentAccount}
                isDynamicLoading={isDynamicLoading}
                currentIsConnected={currentIsConnected}
                disconnectDynamicWallet={() => disconnectDynamicWallet(disconnectWallet)}
                addNotification={addNotification}
                dynamicAccount={dynamicAccount}
                connectWallet={connectWallet}
                disconnectWallet={disconnectWallet}
                walletType={walletType}
                isLoading={walletLoading}
                primaryWallet={primaryWallet}
              />
            </div>
          </div>
        </header>
      </div>
      <div className="mx-[1.2rem]">
        <div className="max-w-[800px] mx-auto p-4">
          <div className="flex flex-col gap-3">
            {walletError && (
              <div className="alert error">{walletError}</div>
            )}

            {activeTab === 'settings' && currentIsConnected && (
              <div className="bg-gradient-to-br to-cyan-50 rounded-2xl shadow-xl border border-blue-200 p-6 mb-6 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]">
                <div className="mb-4">
                  <div className="flex items-center gap-4">
                    <UserProfile 
                      address={currentAccount}
                      userData={userProfile}
                      onChainUserData={currentUserOnChainData}
                      size={64}
                      showAddress={true}
                      truncateAddress={true}
                      onEditProfile={() => {
                        if (userProfile) {
                          setEditUsername(userProfile.username || '');
                          setEditAvatar(userProfile.avatar || '');
                        } else {
                          setEditUsername('');
                          setEditAvatar('');
                        }
                        setShowProfileSettings(true);
                      }}
                      className="cursor-pointer transition-all duration-200 hover:scale-105"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="space-y-2">
                    <div className="flex items-center bg-gray-50 rounded-lg p-1">
                      <span className="font-medium text-gray-700 mr-2 min-w-[120px]">Wallet Type:</span>
                      <span className={`${TEXT_STYLES.body}`}>
                        {walletType === 'dynamic' ? 'Dynamic Wallet' : 'Linera Wallet'}
                      </span>
                    </div>
                    {currentAccount && (
                      <div className="flex items-center bg-gray-50 rounded-lg p-1">
                        <span className="font-medium text-gray-700 mr-2 min-w-[120px]">Wallet Address:</span>
                      <span 
                        className="text-sm text-gray-600 cursor-pointer break-all hover:text-gray-800 transition-colors"
                        onClick={(e) => copyToClipboard(currentAccount, e)}
                        title="Click to copy wallet address"
                      >
                        {appState.ui.isMobile ? `${currentAccount.slice(0, 8)}...${currentAccount.slice(-6)}` : currentAccount}
                      </span>
                      </div>
                    )}
                    {connectedWalletChainId && (
                      <div className="flex items-center bg-gray-50 rounded-lg p-1">
                        <span className="font-medium text-gray-700 mr-2 min-w-[120px]">Wallet Chain:</span>
                        <span 
                          className="text-sm text-gray-600 cursor-pointer break-all hover:text-gray-800 transition-colors"
                          onClick={(e) => copyToClipboard(connectedWalletChainId, e)}
                          title="Click to copy wallet chain"
                        >
                          {appState.ui.isMobile ? `${connectedWalletChainId.slice(0, 8)}...${connectedWalletChainId.slice(-6)}` : connectedWalletChainId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {connectionError && <div className="alert error">{connectionError}</div>}
            {gmOps.queryError && !gmOps.queryError.message.includes('Failed to parse') && (
              <div className="alert error">
                Error: {gmOps.queryError.message}
                {queryRetryCount < 3 && <span> (Retrying... {queryRetryCount}/3)</span>}
              </div>
            )}

            {activeTab === 'messages' && (
              <>
                {gmOps.loading && !gmOps.data && <div className="loading">Loading statistics...</div>}
                <div className="bg-white border-2 border-[rgba(0,123,255,0.1)] rounded-xl px-4 py-2 shadow-sm w-full animate-fadeIn transition-all duration-300 hover:shadow-md">                  
                  <div className="flex justify-between items-start">
                    <div className="flex-0 flex-shrink-0 w-[15%] flex flex-col gap-2.5 pl-3">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.5rem] text-gray-600 font-medium uppercase tracking-[0.5px]">Total GMIC：</span>
                          <span className="text-xl font-light text-[#ff2a00] font-mono leading-[1.25rem]">
                            {gmOps.data?.totalMessages ?? (gmOps.loading ? '***' : '0')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[0.5rem] text-gray-600 font-medium uppercase tracking-[0.5px]">Your GMIC：</span>
                          <span className="text-xl font-light text-[#ff2a00] font-mono leading-[1.25rem]">
                            {currentIsConnected && gmOps.isValidAccountOwner(currentAccount) && gmOps.walletMessagesData?.walletMessages !== null ? (
                              gmOps.walletMessagesData.walletMessages
                            ) : (
                              <span className="connect-wallet-prompt">？</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-0 flex-shrink-0 w-[85%] flex flex-col gap-2 p-4">
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-semibold text-[#ff2a00]">Cooldown Timer</div>
                        <div className={`text-xs font-semibold ${localCooldownEnabled ? 'text-[#ff2a00]' : 'text-[#4ade80]'}`} data-status={localCooldownEnabled ? 'enabled' : 'disabled'}>
                          {localCooldownEnabled ? 'Enabled' : 'Disabled'}
                        </div>
                      </div>
                      <div>
                        <div className="w-full h-1 relative rounded-lg">
                          <div className="absolute inset-0 bg-[rgba(255,42,0,0.1)] rounded-lg"></div>
                          <div 
                            className={`absolute top-0 left-0 h-full rounded-lg transition-all duration-300 ${localCooldownEnabled ? (cooldownRemaining > 0 ? 'bg-gradient-to-r from-[#4ade80] via-[#ffa500] to-[#ff2a00]' : 'bg-[#4ade80]') : 'w-full bg-[#4ade80]'}`}
                            style={{ 
                              width: localCooldownEnabled ? 
                                (cooldownRemaining > 0 ? 
                                  `${Math.max(0, Math.min(100, (cooldownRemaining / 86400000) * 100))}%` : 
                                  '0%') : 
                                '100%'
                            }}
                          ></div>
                          {localCooldownEnabled && cooldownRemaining > 0 && (
                            <div 
                              className="absolute text-black text-xs font-medium px-1.5 py-0.5 rounded bg-white shadow-sm whitespace-nowrap z-10 pointer-events-none transition-all duration-300 top-full transform -translate-x-1/2 translate-y-1"
                              style={{ 
                                left: `${Math.max(0, Math.min(100, (cooldownRemaining / 86400000) * 100))}%`
                              }}
                            >
                              {gmOps.formatCooldown(cooldownRemaining)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
        
            {(additionalData.whitelistData?.isUserWhitelisted === true) && activeTab === 'settings' && (
              <>
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-xl border border-purple-200 p-6 mb-6 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-1">24-Hour Limit Settings</h3>
                      <p className="text-sm text-gray-600">Current Status: <span className={`font-bold ${additionalData.cooldownStatusData?.getCooldownStatus?.enabled ? 'text-green-600' : 'text-red-600'}`}>
                          {additionalData.cooldownStatusData?.getCooldownStatus?.enabled ? 'ENABLED' : 'DISABLED'}
                        </span></p>
                    </div>
                    <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full text-xs font-semibold shadow-sm">Whitelist Only</span>
                  </div>
                  <div className="p-2 bg-white/50 rounded-lg border border-gray-200/50">
                    <div className="mt-2">
                      <button
                        className={`w-full px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 shadow-md ${
                          additionalData.cooldownStatusData?.getCooldownStatus?.enabled 
                            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 hover:shadow-lg hover:scale-[1.02]' 
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 hover:shadow-lg hover:scale-[1.02]'
                        } ${operationStatus === "processing" ? 'opacity-60 cursor-not-allowed hover:scale-100' : ''}`}
                        onClick={() => handleToggleCooldown(!additionalData.cooldownStatusData?.getCooldownStatus?.enabled)}
                        disabled={operationStatus === "processing"}
                      >
                        {operationStatus === "processing" ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin">⏳</span> Updating...
                          </span>
                        ) : additionalData.cooldownStatusData?.getCooldownStatus?.enabled ? (
                          <span className="flex items-center justify-center gap-2">🔓 Disable 24-Hour Limit</span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">🔒 Enable 24-Hour Limit</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'settings' && (
              <>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-xl border border-blue-200 p-6 mb-6 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Target Chain Settings</h3>
                    <p className="text-sm text-gray-600 mt-1">Select the chain for your operations</p>
                  </div>
                  <div className="space-y-4 bg-white/50 p-4 rounded-lg border border-gray-200/50">
                    {walletType === 'dynamic' ? (
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          id="contract-chain"
                          name="targetChain"
                          value={chainId}
                          checked={true}
                          disabled={true}
                          className="h-4 w-4 text-[#ff2a00] focus:ring-[#ff2a00]"
                        />
                        <label htmlFor="contract-chain" className="flex items-center cursor-pointer transition-all duration-200 hover:bg-gray-50/50 p-2 rounded-lg">
                          <span className="font-medium text-gray-800 mr-3 w-32 flex-shrink-0 tracking-tight">Contract Chain：</span>
                          <span className={`text-sm ${targetChainId === chainId ? 'text-gray-700 font-medium truncate' : 'text-gray-600'}`}>
                            {formatAddressForDisplay(chainId, appState.ui.isMobile, 8, 6)}
                          </span>
                        </label>
                      </div>
                    ) : (
                      <>
                        {connectedWalletChainId && (
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              id="wallet-chain"
                              name="targetChain"
                              value={connectedWalletChainId}
                              checked={targetChainId === connectedWalletChainId}
                              onChange={() => {
                                isManualTargetChainChange.current = true;
                                setTargetChainId(connectedWalletChainId);
                              }}
                              className="h-4 w-4 text-[#ff2a00] focus:ring-[#ff2a00]"
                            />
                            <label htmlFor="wallet-chain" className="flex items-center cursor-pointer transition-all duration-200 hover:bg-gray-50/50 p-2 rounded-lg">
                          <span className="font-medium text-gray-800 mr-3 w-32 flex-shrink-0 tracking-tight">Wallet Chain：</span>
                          <span className={`text-sm ${targetChainId === connectedWalletChainId ? 'text-gray-700 font-medium truncate' : 'text-gray-600'}`}>
                            {formatAddressForDisplay(connectedWalletChainId, appState.ui.isMobile, 8, 6)}
                          </span>
                        </label>
                          </div>
                        )}
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            id="contract-chain"
                            name="targetChain"
                            value={chainId}
                            checked={targetChainId === chainId}
                            onChange={() => {
                              isManualTargetChainChange.current = true;
                              setTargetChainId(chainId);
                            }}
                            className="h-4 w-4 text-[#ff2a00] focus:ring-[#ff2a00]"
                          />
                          <label htmlFor="contract-chain" className="flex items-center cursor-pointer transition-all duration-200 hover:bg-gray-50/50 p-2 rounded-lg">
                            <span className="font-medium text-gray-800 mr-3 w-32 flex-shrink-0 tracking-tight">Contract Chain：</span>
                            <span className={`text-sm ${targetChainId === chainId ? 'text-gray-700 font-medium truncate' : 'text-gray-600'}`}>
                              {formatAddressForDisplay(chainId, appState.ui.isMobile, 8, 6)}
                            </span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6 transition-all duration-300 hover:shadow-xl">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Chain Information</h3>
                  </div>
                  <div className="space-y-3">
                    <p className="flex items-center">
                      <span className="font-medium text-gray-700 mr-2 min-w-[120px]">Application ID:</span>
                      <span 
                        className="text-sm text-gray-600 cursor-pointer break-all"
                        onClick={(e) => copyToClipboard(appId, e)}
                        title="Click to copy Application ID"
                      >
                        {formatAddressForDisplay(appId, appState.ui.isMobile, 8, 6)}
                      </span>
                    </p>
                    <p className="flex items-center">
                      <span className="font-medium text-gray-700 mr-2 min-w-[120px]">Contract Chain:</span>
                      <span 
                        className="text-sm text-gray-600 cursor-pointer break-all"
                        onClick={(e) => copyToClipboard(chainId, e)}
                        title="Click to copy Contract chain"
                      >
                        {formatAddressForDisplay(chainId, appState.ui.isMobile, 8, 6)}
                      </span>
                    </p>
                    <p className="flex items-center">
                      <span className="font-medium text-gray-700 mr-2 min-w-[120px]">Contract Owner:</span>
                      <span 
                        className="text-sm text-gray-600 cursor-pointer break-all"
                        onClick={(e) => copyToClipboard(ownerId, e)}
                        title="Click to copy contract owner"
                      >
                        {formatAddressForDisplay(ownerId, appState.ui.isMobile, 8, 6)}
                      </span>
                    </p>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'messages' && (
              <>
                <ChatHistory 
                  currentAccount={currentAccount} 
                  isMobile={appState.ui.isMobile} 
                  gmOps={gmOps} 
                  currentChatPartner={currentChatPartner}
                  onChatPartnerChange={handleChatPartnerChange}
                  currentIsConnected={currentIsConnected}
                />

                <div className={`${CARD_STYLES.base} border border-[rgba(255,42,0,0.15)] p-4 transition-all duration-300 hover:shadow-lg hover:shadow-[rgba(255,42,0,0.2)] relative z-10 overflow-visible`}>
                  <div className="flex items-center p-2 px-3 mb-3 bg-[rgba(255,42,0,0.1)] rounded-lg border border-[rgba(255,42,0,0.2)] text-sm animate-fadeIn">
                    <span className="font-medium mr-2">To:</span>
                    {currentChatPartner ? (
                      <>
                        <span className="text-xl mr-2">👤</span>
                        <span className={`${TEXT_STYLES.body} font-medium`}>{formatAddressForDisplay(currentChatPartner, appState.ui.isMobile, 6, 4)}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl mr-2">🤖</span>
                        <span className="flex items-center">
                            <span className="font-semibold">GMIC Bot (Default Receiver)</span>
                          </span>
                      </>
                    )}
                    {currentChatPartner && (
                      <button 
                        className="ml-auto text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                        onClick={() => handleChatPartnerChange(null)}
                        title="Clear recipient"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="relative flex items-center">
                    <div className="flex items-center w-full">
                      <button 
                        className={`mr-2 p-2 rounded-full hover:bg-gray-100 hover:scale-105 transition-all duration-300 ease ${isVoiceMode ? 'bg-blue-50 text-blue-500 border-2 border-blue-200' : 'border border-gray-200'}`}
                        onClick={() => setIsVoiceMode(!isVoiceMode)}
                        disabled={isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected)}
                        title={isVoiceMode ? "Switch to text mode" : "Switch to voice mode"}
                      >
                        <div className={`h-6 w-6 flex items-center justify-center`}>
                          <KeyboardIcon className={`absolute transition-all duration-300 ease ${isVoiceMode ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`} />
                          <VoiceIcon className={`absolute transition-all duration-300 ease text-[1.1rem] ${isVoiceMode ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`} />
                        </div>
                      </button>
                      
                      {isVoiceMode ? (
                        <button 
                            className={`${CHAT_STYLES.button} flex-grow py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${isLongPressing ? 'bg-[#ff4522] scale-105' : ''}`} 
                            id="sendButton"
                            onMouseDown={handleVoicePressStart}
                            onMouseUp={handleVoicePressEnd}
                            onMouseLeave={handleVoicePressEnd}
                            onTouchStart={handleVoicePressStart}
                            onTouchEnd={handleVoicePressEnd}
                            disabled={isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected) || isSendingMessage}
                          >
                          {operationStatus === "processing" ? (
                            <div className="flex items-center gap-2">
                              <span className="animate-spin">⏳</span>
                              <span>Sending...</span>
                            </div>
                          ) : !currentIsConnected ? (
                            <div className="flex items-center gap-2">
                              <span>🔒</span>
                              <span>Connect wallet</span>
                            </div>
                          ) : !gmOps.isValidAccountOwner(currentAccount) ? (
                            <div className="flex items-center gap-2">
                              <span>🔒</span>
                              <span>Invalid account</span>
                            </div>
                          ) : localCooldownEnabled && cooldownRemaining > 0 ? (
                            <div className="flex items-center gap-2">
                              <span>🔓</span>
                              <span>{gmOps.formatCooldown(cooldownRemaining)}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <VoiceIcon className="w-5 h-5" />
                              <span>Hold to speak</span>
                            </div>
                          )}
                        </button>
                      ) : (
                        <div className="flex-grow mx-2 relative flex items-center">
                          <textarea 
                            className={`${CHAT_STYLES.input} overflow-hidden resize-none`}
                            placeholder={
                              !currentIsConnected ? "Please connect wallet" :
                              !gmOps.isValidAccountOwner(currentAccount) ? "Invalid account" :
                              (localCooldownEnabled && cooldownRemaining > 0) ? "24-hour cooldown active" :
                              "GMicrochains"
                            }
                            value={customMessageEnabled ? customMessage : ""}
                            onChange={(e) => {
                              if (customMessageEnabled) {
                                const newValue = e.target.value;
                                if (newValue.length <= 280) {
                                  handleCustomMessageChange(e);                              
                                  const textarea = e.target;
                                  textarea.style.height = 'auto';
                                  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
                                }
                              }
                            }}
                            onFocus={() => {
                              setMessageInputFocused(true);
                            }}
                            onBlur={(e) => {
                              setMessageInputFocused(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (messageInputFocused && currentIsConnected && !isSendingMessage) {
                                  handleSendGM("text");
                                }
                              }
                            }}
                            autoFocus={false}
                            rows={1}
                            maxLength={500}
                            disabled={!currentIsConnected || !gmOps.isValidAccountOwner(currentAccount) || (localCooldownEnabled && cooldownRemaining > 0)}
                          />
                          {customMessageEnabled && customMessage.length > 0 && (
                            <div className="absolute bottom-1 right-10 text-xs text-gray-500 bg-white/80 px-1 rounded">
                              {customMessage.length}/500
                            </div>
                          )}
                          <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 z-10 ${currentChatPartner ? 'hidden' : ''} ${showContactList ? 'active' : ''}`}>
                            {!showHistoryDropdown && !currentChatPartner && (
                              <div 
                                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm transition-all duration-300"
                                onClick={() => {
                                  if (!currentIsConnected || !gmOps.isValidAccountOwner(currentAccount) || (localCooldownEnabled && cooldownRemaining > 0)) {
                                    return;
                                  }
                                  setShowContactList(!showContactList);
                                }}
                                style={{
                                  opacity: (!currentIsConnected || !gmOps.isValidAccountOwner(currentAccount) || (localCooldownEnabled && cooldownRemaining > 0)) ? '0.5' : '1',
                                  cursor: (!currentIsConnected || !gmOps.isValidAccountOwner(currentAccount) || (localCooldownEnabled && cooldownRemaining > 0)) ? 'not-allowed' : 'pointer'
                                }}
                                title={
                                  !currentIsConnected ? "Please connect wallet" :
                                  !gmOps.isValidAccountOwner(currentAccount) ? "Invalid account" :
                                  (localCooldownEnabled && cooldownRemaining > 0) ? "24-hour cooldown active" :
                                  "Select contact"
                                }
                              >
                                👤
                              </div>
                            )}
                            {showContactList && (
                              <div className="absolute bottom-full right-0 bg-white border border-gray-300 rounded-lg shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-50 min-w-[330px] mb-1 animate-[contactDropdownFadeIn_0.2s_ease-out] sm:min-w-[280px] sm:right-[-10px] contact-dropdown">
                                <div className="py-2">
                                  <div 
                                    className="flex items-center p-2.5 px-3 cursor-pointer transition-all duration-200 gap-2.5 rounded-md mx-1 hover:bg-gray-100 hover:translate-x-0.5 active:translate-x-0"
                                    onClick={() => {
                                      const wuya51Address = import.meta.env.VITE_WHITELIST_ADDRESS;

                                      if (currentAccount && currentAccount.toLowerCase() === wuya51Address.toLowerCase()) {
                                        addNotification('Cannot send GMicrochains to yourself', 'error');
                                        setShowContactList(false);
                                        return;
                                      }
                                      setRecipientAddress(wuya51Address);
                                      setCurrentChatPartner(wuya51Address);
                                      setShowContactList(false);
                                    }}
                                  >
                                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm overflow-hidden">
                                      <img 
                                        src="https://salmon-main-vole-335.mypinata.cloud/ipfs/QmXNeLnSbwDbQUUCh9bTP8H72votCHMEXxtfoMqhXPB4g1" 
                                        alt="Avatar" 
                                        className="w-full h-full object-cover"
                                      />
                                    </span>
                                    <span className={`${TEXT_STYLES.body} font-medium`}>wuya51</span>
                                    <span className="text-xs text-gray-600 font-mono ml-auto">{formatAddressForDisplay(import.meta.env.VITE_WHITELIST_ADDRESS, appState.ui.isMobile)}</span>
                                  </div>
                                  <div 
                                    className="flex items-center p-2.5 px-3 cursor-pointer transition-all duration-200 gap-2.5 rounded-md mx-1 hover:bg-gray-100 hover:translate-x-0.5 active:translate-x-0"
                                    onClick={() => {
                                      const gmicAddress = import.meta.env.VITE_APP_ID;

                                      if (currentAccount && currentAccount.toLowerCase() === gmicAddress.toLowerCase()) {
                                        addNotification('Cannot send GMicrochains to yourself', 'error');
                                        setShowContactList(false);
                                        return;
                                      }
                                      setRecipientAddress(formatAccountOwner(gmicAddress));
                                      setCurrentChatPartner(formatAccountOwner(gmicAddress));
                                      setShowContactList(false);
                                    }}
                                  >
                                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">🤖</span>
                                    <span className={`${TEXT_STYLES.body} font-medium`}>GMIC</span>
                                    <span className="text-xs text-gray-600 font-mono ml-auto">{formatAddressForDisplay(formatAccountOwner(import.meta.env.VITE_APP_ID), appState.ui.isMobile, 6, 4)}</span>
                                  </div>
                                  <div className="flex flex-col p-3 gap-2">
                                    <input
                                      type="text"
                                      className={`${INPUT_STYLES.base} ${newRecipientValidationError ? INPUT_STYLES.error : ''}`}
                                      placeholder="Enter recipient address (0x...)"
                                      value={newRecipientAddress}
                                      onChange={(e) => {
                                        setNewRecipientAddress(e.target.value);
                                        if (newRecipientValidationError) {
                                          setNewRecipientValidationError('');
                                        }
                                      }}
                                      onBlur={() => {
                                        if (gmOps && gmOps.validateRecipientAddress) {
                                          const validation = gmOps.validateRecipientAddress(newRecipientAddress);
                                          if (!validation.isValid) {
                                            setNewRecipientValidationError(validation.error);
                                          } else {
                                            setNewRecipientValidationError('');
                                          }
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                    <button 
                                      className={`${BUTTON_STYLES.primary} w-full p-2 px-4 border-none rounded-md text-sm font-medium cursor-pointer transition-all duration-200 ${newRecipientValidationError ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (gmOps && gmOps.validateRecipientAddress) {
                                          const validation = gmOps.validateRecipientAddress(newRecipientAddress);
                                          if (!validation.isValid) {
                                            setNewRecipientValidationError(validation.error);
                                            return;
                                          }
                                        }
                                        
                                        if (newRecipientAddress.trim()) {
                                          setRecipientAddress(newRecipientAddress.trim());
                                          setCurrentChatPartner(newRecipientAddress.trim());
                                          setShowContactList(false);
                                          setNewRecipientAddress('');
                                          setNewRecipientValidationError('');
                                          
                                          const newContact = {
                                            address: newRecipientAddress.trim(),
                                            name: '',
                                            avatar: '👤'
                                          };
                                          setRecentContacts(prev => [newContact, ...prev.filter(c => c.address !== newRecipientAddress.trim())]);
                                        }
                                      }}
                                      disabled={!!newRecipientValidationError}
                                    >
                                      Set Recipient
                                    </button>
                                    {newRecipientValidationError && (
                                      <div className="text-xs text-red-500 mt-1">
                                        {newRecipientValidationError}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <div className="flex flex-col gap-1 mr-2">
                          <button 
                            className="relative bg-gradient-to-br from-[#ff6b6b] to-[#ffa726] border-none text-xs font-semibold p-1 w-6 h-6 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-gradient-to-br hover:from-[#ff5252] hover:to-[#ff9800] hover:scale-130 hover:rotate-360 hover:shadow-lg hover:shadow-[rgba(255,107,107,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:transform-none disabled:hover:shadow-none"
                            onClick={() => {
                              setShowEmojiPicker(!showEmojiPicker);
                              setShowGifPicker(false);
                            }}
                            disabled={isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected)}
                            title="Add emoji"
                          >
                            😊
                          </button>
                          
                          <button 
                            className="relative bg-gradient-to-br from-[#4CAF50] to-[#45a049] border-none text-xs font-semibold p-1 w-6 h-6 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-gradient-to-br hover:from-[#43A047] hover:to-[#388E3C] hover:scale-130 hover:rotate-360 hover:shadow-lg hover:shadow-[rgba(76,175,80,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:transform-none disabled:hover:shadow-none"
                            onClick={() => {
                              if (!isSendingMessage) {
                                setShowGifPicker(!showGifPicker);
                                setShowEmojiPicker(false);
                              }
                            }}
                            disabled={isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected) || isSendingMessage}
                            title="Add GIF"
                          >
                            GIF
                          </button>
                        </div>
              
                        {!showGifPicker && (
                          <button 
                            className={`${CHAT_STYLES.button}`}
                            onClick={() => {
                              if (!isSendingMessage) {
                                handleSendGM("text");
                              }
                            }}
                            disabled={isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected) || isSendingMessage}
                            title="Send message"
                          >
                            {operationStatus === "processing" ? (
                              <span className="button-loading">
                                <span className="spinner">⏳</span>
                              </span>
                            ) : !currentIsConnected ? (
                              <span>🔒 Send</span>
                            ) : (
                              "Send"
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>                             
                </div>
              </>
            )}

            {activeTab === 'leaderboards' && (
              <div className={`${CARD_STYLES.base} border border-[rgba(255,42,0,0.15)] p-4 transition-all duration-300 hover:shadow-md`}>
                <Leaderboard
                  currentAccount={currentAccount}
                  isMobile={appState.ui.isMobile}
                  copyToClipboard={copyToClipboard}
                />
              </div>
            )}
            
            
          </div>
        </div>
    
        {showEmojiPicker && (
          <EmojiPicker 
            onEmojiSelect={addEmojiToMessage}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
        
        {showGifPicker && (
          <GifPicker 
            onGifSelect={(gifUrl) => handleGifSelect(gifUrl, gmOps)}
            onClose={() => setShowGifPicker(false)}
          />
        )}

        
        {showVoicePopup && (
          <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-full shadow-lg z-50 flex flex-col items-center gap-1 max-w-xs w-auto transition-all duration-300 ease-in-out`}>
            <div className={`${voicePopupType === 'recording' ? 'text-blue-400' : voicePopupType === 'error' ? 'text-red-400' : voicePopupType === 'success' ? 'text-green-400' : 'text-blue-400'}`}>
              {voicePopupType === 'recording' ? <VoiceIcon className="w-6 h-6" /> : 
               voicePopupType === 'error' ? '❌' : 
               voicePopupType === 'success' ? '✅' : <VoiceIcon className="w-6 h-6" />}
            </div>
            <div className="text-xs font-medium whitespace-nowrap">{voicePopupText}</div>
            {voicePopupType === 'recording' && (
              <div className="text-xs text-gray-300 whitespace-nowrap">
                {recordingTime.toFixed(1)}s
              </div>
            )}
          </div>
        )}
      </div>
    
      <NotificationCenter 
        notifications={notifications}
        onRemoveNotification={removeNotification}
        gmRecords={gmOps.streamEventsData || []} 
        currentAccount={currentAccount}
        gmOperations={gmOps}
        chainId={chainId}
      />
      

    </ErrorBoundary>
  );
}

export default App;