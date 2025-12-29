import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWallet, WalletConnector } from './WalletProvider';
import { DynamicConnectButton, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import "./App.css";
import GMOperations, { useGMAdditionalData, useLeaderboardData, useCooldownData, useUserData } from './GMOperations';
import NotificationCenter from './NotificationCenter';
import Leaderboard from './Leaderboard';
import GifPicker from './components/GifPicker';
import EmojiPicker from './components/EmojiPicker';
import ChatHistory from './components/ChatHistory';
import UserProfile from './components/UserProfile';

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

const formatAccountOwner = (address) => {
  if (!address) return '';
  const cleanAddress = address.trim();
  if (cleanAddress.startsWith('0x')) {
    return cleanAddress.toLowerCase();
  }
  return `0x${cleanAddress.toLowerCase()}`;
};

const formatAddressForDisplay = (address, isMobile = false, startChars = 6, endChars = 4) => {
    if (!address) return '';
    const isMobileView = isMobile || window.innerWidth <= 768;
    return isMobileView
      ? `${address.slice(0, startChars)}...${address.slice(-endChars)}`
      : address;
  };

const MAX_MESSAGE_LENGTH = 280;
const WARNING_THRESHOLD = 250;

const uploadToPinata = async (file, filename) => {
  if (!file) return { success: false, error: 'No file provided' };
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    if (filename) {
      formData.append('filename', filename);
    }
    
    const apiKey = import.meta.env.VITE_PINATA_API_KEY;
    const secretApiKey = import.meta.env.VITE_PINATA_SECRET_API_KEY;
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': secretApiKey,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata upload failed: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.IpfsHash) {
      const ipfsUrl = `https://salmon-main-vole-335.mypinata.cloud/ipfs/${result.IpfsHash}`;
      return { success: true, url: ipfsUrl };
    } else {
      throw new Error('No IPFS hash returned from Pinata');
    }
  } catch (error) {
    console.error('Upload to Pinata error:', error);
    return { success: false, error: error.message };
  }
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
        <div className="error-boundary">
          <div className="error-icon">⚠️</div>
          <h2>Oops! Something went wrong</h2>
          <p className="error-message">We're sorry, but something unexpected happened.</p>
          <details className="error-details">
            <summary>Technical Details (for developers)</summary>
            <div className="error-content">
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </div>
          </details>
          <button 
            className="retry-button"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </button>
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
        '0xfe609ad118ba733dafb3ce2b6094c86a441b10de4ffd1651251fffe973efd959': {
          name: 'wuya51',
          avatar: '👤'
        },
        [import.meta.env.VITE_OWNER_ID]: {
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
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [profileSaveStatus, setProfileSaveStatus] = useState(null);
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
  const [operationStatus, setOperationStatus] = useState(null);
  const [claimStatus, setClaimStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [queryRetryCount, setQueryRetryCount] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [addressValidationError, setAddressValidationError] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [previousTotalMessages, setPreviousTotalMessages] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const getInitialActiveTab = () => {
    const savedActiveTab = localStorage.getItem('activeTab');
    return savedActiveTab || 'messages';
  };
  const [activeTab, setActiveTab] = useState(getInitialActiveTab());
  const [cooldownStatus, setCooldownStatus] = useState(null);
  const [localCooldownEnabled, setLocalCooldownEnabled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [gmRecords, setGmRecords] = useState([]);
  const previousEventCountRef = useRef(0);
  const previousLatestTimestampRef = useRef(0);
  const pageLoadTimestampRef = useRef(0);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customMessageEnabled, setCustomMessageEnabled] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedMessage, setSelectedMessage] = useState('gm');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGif, setSelectedGif] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showVoicePopup, setShowVoicePopup] = useState(false);
  const [voicePopupText, setVoicePopupText] = useState('');
  const [voicePopupType, setVoicePopupType] = useState('normal');
  const [messageInputFocused, setMessageInputFocused] = useState(false);
  const [isMessageInputActive, setIsMessageInputActive] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showContactList, setShowContactList] = useState(false);
  const [newRecipientAddress, setNewRecipientAddress] = useState('');
  const [newRecipientValidationError, setNewRecipientValidationError] = useState('');
  const [recentContacts, setRecentContacts] = useState([
    {
      address: '0xfe609ad118ba733dafb3ce2b6094c86a441b10de4ffd1651251fffe973efd959',
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
    setIsRecording(false);
    setRecordingTime(0);
    setShowVoicePopup(false);
  }, [ownerId]);
  
  const addEmojiToMessage = (emoji) => {
    setCustomMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    setMessageInputFocused(true);
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
      setShowVoicePopup(true);
      setTimeout(() => setShowVoicePopup(false), 2000);
      return;
    }
    
    resetRecordingState();

    setShowVoicePopup(true);
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
      setIsRecording(true);
      setRecordingTime(0);

      let startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const displayTime = Math.min(elapsed, 10);
        
        setRecordingTime(displayTime);
        setVoicePopupText(`Recording... ${displayTime.toFixed(1)}s`);
        
        if (elapsed >= 10 && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
            const timestamp = performance.now();
            const microTimestamp = Math.floor(timestamp * 1000);
            const filename = `gmic-voice-${microTimestamp}.webm`;
            
            setVoicePopupText('Auto-sent (max 10s)');
            setVoicePopupType('success');
            setShowVoicePopup(true);
            setTimeout(() => setShowVoicePopup(false), 1500);
            
            const audioData = [...audioChunksRef.current];
            audioChunksRef.current = [];
            
            saveVoiceToLocal(audioData, filename);
          }
      }, 100);
    } catch (error) {

      setVoicePopupText('Cannot access microphone');
      setVoicePopupType('error');
      setIsRecording(false);
    }
  };

  const handleVoicePressEnd = () => {
    setShowVoicePopup(false);
    
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (recordingTime < 1) {
        setVoicePopupText('Recording too short (min 1s)');
        setVoicePopupType('error');
        setShowVoicePopup(true);
        setTimeout(() => {
          setShowVoicePopup(false);
          resetRecordingState();
        }, 1500);
      } else {
        const timestamp = performance.now();
        const microTimestamp = Math.floor(timestamp * 1000);
        const filename = `gmic-voice-${microTimestamp}.webm`;
        
        setVoicePopupText('Uploading voice message...');
        setVoicePopupType('info');
        setShowVoicePopup(true);
        
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
      
      if (result && result.data && result.data.IpfsHash) {

        
        const voiceUrl = result.url || `https://gateway.pinata.cloud/ipfs/${result.data.IpfsHash}`;
        handleSendGM('voice', voiceUrl);
        setVoicePopupText('Voice message sent!');
        setVoicePopupType('success');
        setShowVoicePopup(true);
        setTimeout(() => {
          setShowVoicePopup(false);
          resetRecordingState();
        }, 1500);
      } else {
        throw new Error('Upload failed - no IPFS hash returned');
      }
      
    } catch (error) {
      console.error('❌ Error uploading voice file:', error);
      
      setVoicePopupText('Failed to send voice message');
      setVoicePopupType('error');
      setShowVoicePopup(true);
      setTimeout(() => {
        setShowVoicePopup(false);
        resetRecordingState();
      }, 2000);
    }
  };

  const uploadToPinata = async (audioBlob, filename) => {
    try {

      const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
      const PINATA_SECRET_API_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY;
      
      if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
        throw new Error('Pinata API keys missing in environment variables');
      }

      const formData = new FormData();
      formData.append('file', audioBlob, filename);

      const metadata = JSON.stringify({
        name: filename,
        keyvalues: {
          app: 'gmic-buildathon',
          type: 'voice-message',
          timestamp: Date.now()
        }
      });
      formData.append('pinataMetadata', metadata);


      
      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_API_KEY
        },
        body: formData
      });



      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Pinata upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.IpfsHash) {

      } else {
        throw new Error('Upload failed - no IPFS hash in response');
      }
      
      const gatewayUrl = `https://salmon-main-vole-335.mypinata.cloud/ipfs/${result.IpfsHash}`;

  
      return { 
        success: true, 
        data: result,
        cid: result.IpfsHash, 
        url: gatewayUrl 
      };

    } catch (error) {
      setVoicePopupText('Upload failed');
      setVoicePopupType('error');
      setShowVoicePopup(true);
      setTimeout(() => setShowVoicePopup(false), 3000);
      
      throw error;
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
  const [showShareReferralModal, setShowShareReferralModal] = useState(false);
  const [showInvitedUsersDropdown, setShowInvitedUsersDropdown] = useState(false);
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
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);



  forceUpdateRef.current = forceUpdate;
  cooldownRemainingRef.current = cooldownRemaining;
  activeTabRef.current = activeTab;
  
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
      setSelectedMessage(customMessage || 'gm');
    } else {
      setSelectedMessage('gm');
    }
  }, [customMessageEnabled, customMessage]);

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

    setCustomMessage(value);
    if (customMessageEnabled) {
      setSelectedMessage(value || 'gm');
      
      if (value && !isMessageContentValid(value)) {

      }
    }
  }, [customMessageEnabled, isMessageContentValid]);

  const handleLongPressStart = () => {
    if (isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected)) {
      return;
    }
    
    setIsLongPressing(true);
    const timer = setTimeout(() => {
      setIsVoiceMode(true);
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
      if (showEmojiPicker && 
          !event.target.closest('.emoji-picker-container') && 
          !event.target.closest('.emoji-picker-button')) {
        setShowEmojiPicker(false);
      }
      
      if (showGifPicker && 
          !event.target.closest('.gif-picker-container') && 
          !event.target.closest('.gif-picker-button')) {
        setShowGifPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, showGifPicker]);

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
  const memoizedIsMobile = useMemo(() => isMobile, [isMobile]);
  
  const handleToggleShareReferral = useCallback(() => {
    setShowShareReferralModal(!showShareReferralModal);
  }, [showShareReferralModal]);
  
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
          btn.textContent = 'Copied!';
          btn.style.backgroundColor = '#4CAF50';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
          }, 2000);
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
    localStorage.setItem('activeTab', activeTab);
    activeTabRef.current = activeTab;
    
    const saveTimeout = setTimeout(() => {
      const currentSaved = localStorage.getItem('activeTab');
      if (currentSaved !== activeTab) {
        localStorage.setItem('activeTab', activeTab);
      }
    }, 100);
    
    return () => clearTimeout(saveTimeout);
  }, [activeTab]);

  useEffect(() => {
    const checkAndRestoreActiveTab = () => {
      try {
        const saved = localStorage.getItem('activeTab');
        if (saved && saved !== activeTab && ['messages', 'leaderboards', 'settings'].includes(saved)) {
          setActiveTab(saved);
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
  }, [activeTab]);

  useEffect(() => {
    const tabCheckInterval = setInterval(() => {
      try {
        const saved = localStorage.getItem('activeTab');
        const isValidTab = ['messages', 'leaderboards', 'settings'].includes(activeTab);
        const isSavedValid = saved && ['messages', 'leaderboards', 'settings'].includes(saved);
        
        if (!isValidTab && isSavedValid) {
          setActiveTab(saved);
          activeTabRef.current = saved;
        }
      } catch (error) {

      }
    }, 10000);

    return () => clearInterval(tabCheckInterval);
  }, [activeTab]);
  
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
      primaryWallet
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
      <div className="wallet-connection-section">
        <div className="wallet-button-container">
          {isLineraConnected ? (
            <div 
              className="wallet-info-card linera clickable"
              onClick={handleDisconnectLineraWallet}
              title="Click to disconnect Linera wallet"
            >
              <div className="wallet-address">
                <span className="status-dot"></span>
                {lineraAccount ? `${lineraAccount.slice(0, 6)}...${lineraAccount.slice(-4)}` : 
                 currentAccount ? `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}` : 'Connected'}
              </div>
            </div>
          ) : (
            <button 
              className="connect-btn linera"
              onClick={handleConnectLineraWallet}
              disabled={isLoading && walletType === 'linera'}
            >
              {isLoading && walletType === 'linera' ? "Connecting..." : 'Linera Wallet'}
            </button>
          )}
        </div>
        
        <div className="wallet-button-container">
          {(primaryWallet && primaryWallet.address) || (currentIsConnected && currentAccount && walletType !== 'linera') ? (
            <div 
              className="wallet-info-card dynamic clickable"
              onClick={handleDisconnectDynamicWalletClick}
              title="Click to disconnect wallet"
            >
              <div className="wallet-address">
                <span className="status-dot"></span>
                {primaryWallet?.address ? `${formatAccountOwner(primaryWallet.address).slice(0, 6)}...${formatAccountOwner(primaryWallet.address).slice(-4)}` : 
                 currentAccount ? `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}` : 
                 'Connected'}
              </div>
            </div>
          ) : (
            <div className="wallet-connect-card">
              <DynamicConnectButton>
                <button 
                  className="connect-btn dynamic"
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
      const originalText = element.innerHTML;
      element.innerHTML = 'Copied!';
      element.classList.add('copy-success');
      setTimeout(() => {
        element.innerHTML = originalText;
        element.classList.remove('copy-success');
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
      await (refetchCooldownStatus && refetchCooldownStatus());
      await (refetchCooldownCheck && refetchCooldownCheck());
      await (refetchGmRecord && refetchGmRecord());
      
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
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
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
      const dropdownContainer = document.querySelector('.dropdown-container');
      if (dropdownContainer && !dropdownContainer.contains(event.target)) {
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
          <div className="modal-overlay">
            <div className="profile-settings-modal">
              <div className="modal-header">
                <h3>Edit Profile</h3>
                <button className="modal-close" onClick={handleCancelProfileEdit}>×</button>
              </div>
              
              {profileSaveStatus && profileSaveMessage && (
                <div className={`profile-save-message ${profileSaveStatus}`}>
                  {profileSaveMessage}
                </div>
              )}
              
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Enter username"
                  maxLength={20}
                />
              </div>
              <div className="form-group">
                <label>Profile Photo:</label>
                <div className="avatar-upload-container">
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                  <div 
                    className="avatar-preview" 
                    onClick={() => document.getElementById('avatar-upload').click()}
                    style={{ cursor: 'pointer' }}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" />
                    ) : editAvatar ? (
                      <img src={editAvatar} alt="Current avatar" />
                    ) : (
                      <div className="avatar-placeholder">No photo</div>
                    )}
                  </div>
                  <button type="button" onClick={() => document.getElementById('avatar-upload').click()} className="upload-button">
                    Upload Photo
                  </button>
                </div>
              </div>
              <div className="modal-actions">
                <button onClick={handleSaveProfile} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Save'}
                </button>
                <button onClick={handleCancelProfileEdit} disabled={uploading}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        <button 
          className="referral-floating-btn"
          onClick={handleToggleShareReferral}
          title="Share your referral link"
        >
          🔗 Share Referral
        </button>
        {showShareReferralModal && (
          <div className="modal-overlay" onClick={handleToggleShareReferral}>
            <div className="referral-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Share Your Referral Link ✨</h3>
                <button className="modal-close" onClick={handleToggleShareReferral}>×</button>
              </div>
              <div className="modal-content">
                {memoizedCurrentAccount && (
                  <>
                    <div className="referral-stats">
                      <button 
                        className="refresh-btn" 
                        onClick={() => shareModalAdditionalData?.refetchInvitationStats && shareModalAdditionalData.refetchInvitationStats()}
                        title="Refresh invitation stats"
                      >
                        🔄 Refresh
                      </button>
                      <div className="referral-stat-item">
                        <div className="dropdown-container">
                          <div 
                            className="referral-stat-label dropdown-toggle"
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
                            Invited Users: {showInvitedUsersDropdown ? '▲' : '▼'}
                          </div>
                          <span className="referral-stat-value">{(() => {
                            try {
                              return Number(shareModalAdditionalData?.invitationStatsData?.totalInvited) || 0;
                            } catch (error) {
                              return 0;
                            }
                          })()}</span>
                          <div className={`invited-users-dropdown ${showInvitedUsersDropdown ? 'show' : ''}`}>
                            {invitedUsersLoading ? (
                              <div className="invitation-loading">Loading...</div>
                            ) : invitedUsers.length > 0 ? (
                              <div className="invitation-list">
                                {invitedUsers.map((user, index) => (
                                  <div key={index} className="invitation-item">
                                    <div className="invitation-sender">
                                      {formatAddressForDisplay(user.invitee)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="invitation-empty">No invited users found</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="referral-stat-item">
                        <span className="referral-stat-label">Your Reward Points:</span>
                        <span className="referral-stat-value">{(() => {
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
                            <div className="referral-stat-item">
                              <span className="referral-stat-label">Last Reward:</span>
                              <span className="referral-stat-value">{new Date(Number(lastRewardTime) / 1000).toLocaleString()}</span>
                            </div>
                          ) : null;
                        } catch (error) {
                          return null;
                        }
                      })()}
                    </div>
                    <div className="referral-link-section">
                      <label>Your Referral Link:</label>
                      <div className="link-container">
                        <input 
                          type="text" 
                          value={`${window.location.origin}?inviter=${memoizedCurrentAccount}`}
                          readOnly
                          className="referral-link-input"
                        />
                        <button onClick={copyReferralLink} className={`copy-btn ${copySuccess ? 'copied' : ''}`}>
                          {copySuccess ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="share-options">
                      <p className="share-label">Share directly:</p>
                      <div className="social-buttons">
                        <a 
                          href={`https://twitter.com/intent/tweet?text=Join%20GMicrochains%20and%20use%20my%20referral%20link!&url=${encodeURIComponent(window.location.origin + '?inviter=' + memoizedCurrentAccount)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="social-btn twitter"
                        >
                          Twitter
                        </a>
                        <a 
                          href={`https://t.me/share/url?url=${encodeURIComponent(window.location.origin + '?inviter=' + memoizedCurrentAccount)}&text=Join%20GMicrochains%20and%20use%20my%20referral%20link!`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="social-btn telegram"
                        >
                          Telegram
                        </a>
                      </div>
                    </div>
                    <div className="referral-rewards-info">
                      <p>Invite a user to send their first GMIC → 30 points</p>
                      <p>Each GMIC they send after → +10 points</p>
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
        <header className="top-navbar">
          <div className="navbar-container">
            <div className="logo">
              <img src="/GMic.png" alt="GMIC Logo" className="logo-img" />
            </div>
            <nav className="nav-links">
              <button 
                className={`nav-tab ${activeTab === 'messages' ? 'active' : ''}`}
                onClick={() => setActiveTab('messages')}
              >
                Messages
              </button>
              <button 
                className={`nav-tab ${activeTab === 'leaderboards' ? 'active' : ''}`}
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
                className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </nav>
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
        </header>
      </div>
      <div className="App-content">
        <div className="App">
          <div className="App-header">
            {walletError && (
              <div className="alert error">{walletError}</div>
            )}

            {activeTab === 'settings' && currentIsConnected && (
              <div className="card wallet-card">
                <div className="user-profile-section">
                  <div className="user-profile-content">
                    <UserProfile 
                      address={currentAccount}
                      userData={userProfile}
                      onChainUserData={currentUserOnChainData}
                      size={64}
                      showAddress={true}
                      truncateAddress={true}
                    />
                    <button className="edit-profile-btn" onClick={() => {
                      if (userProfile) {
                        setEditUsername(userProfile.username || '');
                        setEditAvatar(userProfile.avatar || '');
                      } else {
                        setEditUsername('');
                        setEditAvatar('');
                      }
                      setShowProfileSettings(true);
                    }}>
                      Edit Profile
                    </button>
                  </div>
                </div>
                <div className="wallet-info">
                  <div className="wallet-status">
                    <div className="wallet-item">
                      <span className="label">Wallet Type:</span>
                      <span className="wallet-type">
                        {walletType === 'dynamic' ? 'Dynamic Wallet' : 'Linera Wallet'}
                      </span>
                    </div>
                    {currentAccount && (
                      <div className="wallet-item">
                        <span className="label">Wallet Address:</span>
                        <span 
                          className="address-simple"
                          onClick={(e) => copyToClipboard(currentAccount, e)}
                          title="Click to copy wallet address"
                        >
                          {isMobile ? `${currentAccount.slice(0, 8)}...${currentAccount.slice(-6)}` : currentAccount}
                        </span>
                      </div>
                    )}
                    {connectedWalletChainId && (
                      <div className="wallet-item">
                        <span className="label">Wallet Chain:</span>
                        <span 
                          className="address-simple"
                          onClick={(e) => copyToClipboard(connectedWalletChainId, e)}
                          title="Click to copy wallet chain"
                        >
                          {isMobile ? `${connectedWalletChainId.slice(0, 8)}...${connectedWalletChainId.slice(-6)}` : connectedWalletChainId}
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
                <div className="card stats-card">                  
                  <div className="stats-panel">
                    <div className="stats-left">
                      <div className="stats-vertical">
                        <div className="stat-row">
                          <span className="stat-label">Total GMIC：</span>
                          <span className="stat-value">
                            {gmOps.data?.totalMessages ?? (gmOps.loading ? '***' : '0')}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Your GMIC：</span>
                          <span className="stat-value">
                            {currentIsConnected && gmOps.isValidAccountOwner(currentAccount) && gmOps.walletMessagesData?.walletMessages !== null ? (
                              gmOps.walletMessagesData.walletMessages
                            ) : (
                              <span className="connect-wallet-prompt">？</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="cooldown-timer-container">
                      <div className="cooldown-timer-header">
                        <div className="cooldown-timer-label">Cooldown Timer</div>
                        <div className="cooldown-timer-status" data-status={localCooldownEnabled ? 'enabled' : 'disabled'}>
                          {localCooldownEnabled ? 'Enabled' : 'Disabled'}
                        </div>
                      </div>
                      <div className="cooldown-timer-bar-container">
                        <div className="cooldown-timer-bar">
                          <div className="cooldown-timer-track"></div>
                          <div 
                            className={`cooldown-timer-fill ${localCooldownEnabled ? 'active' : 'inactive'} ${cooldownRemaining > 0 ? 'cooldown-remaining' : 'cooldown-complete'}`}
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
                              className={`cooldown-timer-countdown ${((cooldownRemaining / 86400000) * 100) > 90 ? 'below' : 'right'}`}
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
                <div className="card cooldown-control-card">
                  <div className="section-header">
                    <h3>24-Hour Limit Control</h3>
                    <span className="whitelist-badge">Whitelist Only</span>
                  </div>
                  <div className="cooldown-control-content">
                    <div className="cooldown-status-info">
                      <p className="cooldown-status-text">
                        Current Status: <span className={`status ${additionalData.cooldownStatusData?.getCooldownStatus?.enabled ? 'enabled' : 'disabled'}`}>
                          {additionalData.cooldownStatusData?.getCooldownStatus?.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </p>
                      <p className="cooldown-description">
                        {additionalData.cooldownStatusData?.getCooldownStatus?.enabled 
                          ? '24-hour cooldown is currently active for all users' 
                          : '24-hour cooldown is currently disabled'
                        }
                      </p>
                    </div>
                    <div className="cooldown-control-actions">
                      <button
                        className={`action-btn ${additionalData.cooldownStatusData?.getCooldownStatus?.enabled ? 'danger' : 'primary'}`}
                        onClick={() => handleToggleCooldown(!additionalData.cooldownStatusData?.getCooldownStatus?.enabled)}
                        disabled={operationStatus === "processing"}
                      >
                        {operationStatus === "processing" ? (
                          <span className="button-loading">
                            <span className="spinner">⏳</span> Updating...
                          </span>
                        ) : additionalData.cooldownStatusData?.getCooldownStatus?.enabled ? (
                          "🔓 Disable 24-Hour Limit"
                        ) : (
                          "🔒 Enable 24-Hour Limit"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'settings' && (
              <>
                <div className="card chain-selection-card">
                  <div className="section-header">
                    <h3>Target Chain</h3>
                  </div>
                  <div className="chain-options">
                    {walletType === 'dynamic' ? (
                      <div className="chain-option">
                        <input
                          type="radio"
                          id="contract-chain"
                          name="targetChain"
                          value={chainId}
                          checked={true}
                          disabled={true}
                        />
                        <label htmlFor="contract-chain" className="chain-label">
                          <span className="chain-name">Contract Chain：</span>
                          <span className="chain-address">
                            {formatAddressForDisplay(chainId, isMobile, 8, 6)}
                          </span>
                        </label>
                      </div>
                    ) : (
                      <>
                        {connectedWalletChainId && (
                          <div className="chain-option">
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
                            />
                            <label htmlFor="wallet-chain" className="chain-label">
                              <span className="chain-name">Wallet Chain：</span>
                              <span className="chain-address">
                                {formatAddressForDisplay(connectedWalletChainId, isMobile, 8, 6)}
                              </span>
                            </label>
                          </div>
                        )}
                        <div className="chain-option">
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
                          />
                          <label htmlFor="contract-chain" className="chain-label">
                            <span className="chain-name">Contract Chain：</span>
                            <span className="chain-address">
                              {formatAddressForDisplay(chainId, isMobile, 8, 6)}
                            </span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="card chain-info-card">
                  <div className="section-header">
                    <h3>Chain Information</h3>
                  </div>
                  <div className="chain-info">
                    <p>
                      <span className="label">Application ID:</span>
                      <span 
                        className="address-simple"
                        onClick={(e) => copyToClipboard(appId, e)}
                        title="Click to copy Application ID"
                      >
                        {formatAddressForDisplay(appId, isMobile, 8, 6)}
                      </span>
                    </p>
                    <p>
                      <span className="label">Contract Chain:</span>
                      <span 
                        className="address-simple"
                        onClick={(e) => copyToClipboard(chainId, e)}
                        title="Click to copy Contract chain"
                      >
                        {formatAddressForDisplay(chainId, isMobile, 8, 6)}
                      </span>
                    </p>
                    <p>
                      <span className="label">Contract Owner:</span>
                      <span 
                        className="address-simple"
                        onClick={(e) => copyToClipboard(ownerId, e)}
                        title="Click to copy contract owner"
                      >
                        {formatAddressForDisplay(ownerId, isMobile, 8, 6)}
                      </span>
                    </p>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'messages' && (
              <>
                <div className="card chat-history-card">
                  <ChatHistory 
                    currentAccount={currentAccount} 
                    isMobile={isMobile} 
                    gmOps={gmOps} 
                    currentChatPartner={currentChatPartner}
                    onChatPartnerChange={handleChatPartnerChange}
                    currentIsConnected={currentIsConnected}
                  />
                </div>

                <div className="card send-action-card">
                  {currentChatPartner && (
                    <div className="selected-recipient">
                      <span className="recipient-label">To:</span>
                      <span className="recipient-address">{formatAddressForDisplay(currentChatPartner, isMobile, 6, 4)}</span>
                      <button 
                        className="clear-recipient-btn"
                        onClick={() => handleChatPartnerChange(null)}
                        title="Clear recipient"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="send-actions">
                    <div className="send-button-container">
                      <button 
                        className={`voice-toggle ${isVoiceMode ? 'active' : ''}`}
                        onClick={() => setIsVoiceMode(!isVoiceMode)}
                        disabled={isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected)}
                        title={isVoiceMode ? "Switch to text mode" : "Switch to voice mode"}
                      >
                        <div className="icon-container">
                        <div className={`icon-wrapper ${isVoiceMode ? 'show-keyboard' : 'show-voice'}`}>
                          <KeyboardIcon className="keyboard-icon" />
                          <VoiceIcon className="voice-icon" />
                        </div>
                      </div>
                      </button>
                      
                      {isVoiceMode ? (
                        <button 
                          className={`send-button voice-mode ${isLongPressing ? 'long-pressing' : ''}`} 
                          id="sendButton"
                          onMouseDown={handleVoicePressStart}
                          onMouseUp={handleVoicePressEnd}
                          onMouseLeave={handleVoicePressEnd}
                          onTouchStart={handleVoicePressStart}
                          onTouchEnd={handleVoicePressEnd}
                          disabled={isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected) || isSendingMessage}
                        >
                          {operationStatus === "processing" ? (
                            <span className="button-loading">
                              <span className="spinner">⏳</span> Sending...
                            </span>
                          ) : !currentIsConnected ? (
                            "🔒 Connect wallet"
                          ) : !gmOps.isValidAccountOwner(currentAccount) ? (
                            "🔒 Invalid account"
                          ) : localCooldownEnabled && cooldownRemaining > 0 ? (
                            `🔓 ${gmOps.formatCooldown(cooldownRemaining)}`
                          ) : (
                            "🎤 Hold to speak"
                          )}
                        </button>
                      ) : (
                        <div className="message-input-wrapper">
                          <textarea 
                            className="message-input"
                            placeholder={
                              !currentIsConnected ? "Please connect wallet" :
                              !gmOps.isValidAccountOwner(currentAccount) ? "Invalid account" :
                              (localCooldownEnabled && cooldownRemaining > 0) ? "24-hour cooldown active" :
                              "GMicrochains"
                            }
                            value={customMessageEnabled ? customMessage : ""}
                            onChange={(e) => {
                              if (customMessageEnabled) {
                                handleCustomMessageChange(e);                              
                                const textarea = e.target;
                                textarea.style.height = 'auto';
                                textarea.style.height = textarea.scrollHeight + 'px';
                              }
                            }}
                            onFocus={() => {
                              setMessageInputFocused(true);
                            }}
                            onBlur={(e) => {
                              if (e.relatedTarget && e.relatedTarget.className && 
                                  e.relatedTarget.className.includes('send-message-button')) {
                                return;
                              }
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
                            disabled={!currentIsConnected || !gmOps.isValidAccountOwner(currentAccount) || (localCooldownEnabled && cooldownRemaining > 0)}
                          />
                          <div className={`contact-selector ${currentChatPartner ? 'hidden' : ''} ${showContactList ? 'active' : ''}`}>
                            {!showHistoryDropdown && !currentChatPartner && (
                              <div 
                                className="contact-avatar"
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
                              <div className="contact-dropdown">
                                <div className="contact-list">
                                  <div 
                                    className="contact-item"
                                    onClick={() => {
                                      const wuya51Address = '0xfe609ad118ba733dafb3ce2b6094c86a441b10de4ffd1651251fffe973efd959';

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
                                    <span className="contact-avatar">
                                      <img 
                                        src="https://salmon-main-vole-335.mypinata.cloud/ipfs/QmXNeLnSbwDbQUUCh9bTP8H72votCHMEXxtfoMqhXPB4g1" 
                                        alt="Avatar" 
                                        className="avatar-image"
                                      />
                                    </span>
                                    <span className="contact-name">wuya51</span>
                                    <span className="contact-address">0xfe60...f959</span>
                                  </div>
                                  <div 
                                    className="contact-item"
                                    onClick={() => {
                                      const gmicAddress = import.meta.env.VITE_OWNER_ID;

                                      if (currentAccount && currentAccount.toLowerCase() === gmicAddress.toLowerCase()) {
                                        addNotification('Cannot send GMicrochains to yourself', 'error');
                                        setShowContactList(false);
                                        return;
                                      }
                                      setRecipientAddress(gmicAddress);
                                      setCurrentChatPartner(gmicAddress);
                                      setShowContactList(false);

                                    }}
                                  >
                                    <span className="contact-avatar">🤖</span>
                                    <span className="contact-name">GMIC</span>
                                    <span className="contact-address">{import.meta.env.VITE_OWNER_ID.substring(0, 6)}...{import.meta.env.VITE_OWNER_ID.substring(import.meta.env.VITE_OWNER_ID.length - 4)}</span>
                                  </div>
                                  <div className="contact-item set-recipient-input">
                                    <input
                                      type="text"
                                      className={`contact-address-input ${newRecipientValidationError ? 'error' : ''}`}
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
                                      autoFocus
                                    />
                                    <button 
                                      className={`confirm-contact-button ${newRecipientValidationError ? 'disabled' : ''}`}
                                      onClick={() => {
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
                                      <div className="address-validation-error">
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
                      
                      <div className="message-buttons">
                        <button 
                          className="emoji-picker-button"
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
                          className={`send-message-button ${messageInputFocused ? 'send-mode' : 'gif-mode'}`}
                          onClick={() => {

                            if (messageInputFocused && !isSendingMessage) {

                              handleSendGM("text");
                            } else {
                              setShowGifPicker(!showGifPicker);
                              setShowEmojiPicker(false);
                            }
                          }}
                          disabled={isButtonDisabled(operationStatus, currentAccount, gmOps, cooldownRemaining, localCooldownEnabled, currentIsConnected) || isSendingMessage}
                          title={messageInputFocused ? "Send message" : "Add GIF"}
                        >
                            {messageInputFocused ? (
                              operationStatus === "processing" ? (
                                <span className="button-loading">
                                  <span className="spinner">⏳</span>
                                </span>
                              ) : !currentIsConnected ? (
                                <span>🔒 Send</span>
                              ) : (
                                "Send"
                              )
                            ) : "GIF"}
                          </button>
                      </div>
                    </div>
                  </div>                             
                </div>
              </>
            )}

            {activeTab === 'leaderboards' && (
              <div className="leaderboards-container">
                <Leaderboard
                  currentAccount={currentAccount}
                  isMobile={isMobile}
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
          <div className={`voice-recording-popup ${voicePopupType}`}>
            <div className="voice-recording-icon">
              {voicePopupType === 'recording' ? '🎤' : 
               voicePopupType === 'error' ? '❌' : 
               voicePopupType === 'success' ? '✅' : '🎤'}
            </div>
            <div className="voice-recording-text">{voicePopupText}</div>
            {voicePopupType === 'recording' && (
              <div className="voice-recording-time">
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
      
      {showProfileSettings && (
        <div className="profile-settings-modal">
          <div className="profile-settings-content">
            <div className="profile-settings-header">
              <h3>Edit Profile</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowProfileSettings(false)}
              >
                ×
              </button>
            </div>
            
            <div className="avatar-upload-section">
              <div className="avatar-preview">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="avatar-image" />
                ) : (
                  <div className="avatar-placeholder">
                    {editUsername ? editUsername.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              
              <div className="avatar-upload-controls">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarFileSelect}
                />
                <label htmlFor="avatar-upload" className="upload-avatar-btn">
                  Choose Avatar
                </label>
                {selectedAvatarFile && (
                  <span className="selected-file-name">
                    {selectedAvatarFile.name}
                  </span>
                )}
              </div>
            </div>
            
            <div className="username-input-section">
              <label htmlFor="username-input">Username</label>
              <input
                id="username-input"
                type="text"
                placeholder="Enter your username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                maxLength={20}
              />
            </div>
            
            <div className="profile-settings-actions">
              <button 
                className="save-profile-btn"
                onClick={handleSaveProfile}
                disabled={uploading || !editUsername.trim()}
              >
                {uploading ? 'Uploading...' : 'Save Profile'}
              </button>
              <button 
                className="cancel-profile-btn"
                onClick={handleCancelProfileEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;