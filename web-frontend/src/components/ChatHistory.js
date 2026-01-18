import React, { useState, useEffect } from 'react';
import { formatAccountOwner, formatAddressForDisplay } from '../utils/utils';

const normalizeTimestamp = (timestamp) => {
  if (!timestamp) return Date.now();
  
  let num = Number(timestamp);
  if (isNaN(num)) {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    return Date.now();
  }
  
  if (num > 1e15) {
    return Math.floor(num / 1000);
  } else if (num > 1e12) {
    return num;
  } else if (num > 1e9) {
    return num * 1000;
  }
  
  return num;
};

const getContactInfo = (address, event = null, currentAccount = null, isMobile = false) => {
  if (event) {
    if (address === event.sender && event.senderName) {
      return { 
        name: event.senderName, 
        avatar: event.senderAvatar || '👤' 
      };
    }
    if (address === event.recipient && event.recipientName) {
      return { 
        name: event.recipientName, 
        avatar: event.recipientAvatar || '👤' 
      };
    }
  }
  
  if (address === import.meta.env.VITE_WHITELIST_ADDRESS) {
    return { name: 'wuya51', avatar: '👤' };
  }
  
  const contractAddress = import.meta.env.VITE_APP_ID;
  
  if (formatAccountOwner(address) === formatAccountOwner(contractAddress)) {
    return { name: 'GMIC', avatar: '🤖' };
  }
  
  if (address === currentAccount) {
    return { name: 'Me', avatar: '👤' };
  }
  
  return { name: '', avatar: '👤' };
};

const ChatHistory = ({ currentAccount, isMobile, gmOps, currentChatPartner = null, onChatPartnerChange, currentIsConnected }) => {
  const [chatConversations, setChatConversations] = useState([]);
  const [expandedChats, setExpandedChats] = useState({});
  const [playingVoice, setPlayingVoice] = useState(null);
  const [expandedGif, setExpandedGif] = useState(null);
  const [audioElements, setAudioElements] = useState({});
  const [pendingPartnerChange, setPendingPartnerChange] = useState(null);

  const toggleChatExpansion = (address) => {
    setExpandedChats(prev => {
      const isCurrentlyExpanded = !!prev[address];
      const newState = isCurrentlyExpanded ? {} : { [address]: true };
      const newPartner = isCurrentlyExpanded ? null : address;

      if (onChatPartnerChange) {
        onChatPartnerChange(newPartner);
      }
      
      return newState;
    });
  };

  const playVoice = (voiceId, audioUrl) => {
    Object.values(audioElements).forEach(audio => {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    if (playingVoice === voiceId) {
      setPlayingVoice(null);
      return;
    }

    setPlayingVoice(voiceId);
    
    if (!audioElements[voiceId]) {
      const audio = new Audio(audioUrl);
      audioElements[voiceId] = audio;
      setAudioElements({...audioElements});
      
      audio.onended = () => {
        setPlayingVoice(null);
      };
      
      audio.onerror = () => { 
 
         setPlayingVoice(null); 
       }; 
       
       audio.play().catch(err => { 
 
         setPlayingVoice(null); 
       }); 
     } else { 
       audioElements[voiceId].play().catch(err => { 
 
         setPlayingVoice(null);
      });
    }
  };

  const toggleGifExpansion = (gifUrl) => {
    setExpandedGif(expandedGif === gifUrl ? null : gifUrl);
  };

  useEffect(() => {
    if (pendingPartnerChange !== null) {
      if (onChatPartnerChange) {
        onChatPartnerChange(pendingPartnerChange);
      }
      setPendingPartnerChange(null);
    }
  }, [pendingPartnerChange, onChatPartnerChange]);

  useEffect(() => {
    if (currentChatPartner === null) {
      setExpandedChats({});
    } else if (currentChatPartner) {
      setExpandedChats(prev => {
        if (!prev[currentChatPartner]) {
          return { [currentChatPartner]: true };
        }
        return prev;
      });
    }
  }, [currentChatPartner]);

  useEffect(() => {
    if (!currentAccount || !gmOps || !currentIsConnected) {
      setChatConversations([]);
      return;
    }

    try {
      const streamEvents = Array.isArray(gmOps.streamEventsData) ? gmOps.streamEventsData : [];
      
      let gmEvents, receivedGmEvents;
      const mySentEvents = Array.isArray(gmOps.mySentEventsData) ? gmOps.mySentEventsData : [];
      const partnerSentEvents = Array.isArray(gmOps.partnerSentEventsData) ? gmOps.partnerSentEventsData : [];
      const myReceivedEvents = Array.isArray(gmOps.myReceivedEventsData) ? gmOps.myReceivedEventsData : [];
      const partnerReceivedEvents = Array.isArray(gmOps.partnerReceivedEventsData) ? gmOps.partnerReceivedEventsData : [];
      if (!currentChatPartner) {
        gmEvents = [...mySentEvents, ...partnerSentEvents];
        receivedGmEvents = [...myReceivedEvents, ...partnerReceivedEvents];
      } else {
        const detailedGmEvents = [...mySentEvents, ...partnerReceivedEvents];
        const detailedReceivedGmEvents = [...partnerSentEvents, ...myReceivedEvents];
        
        if (detailedGmEvents.length > 0 || detailedReceivedGmEvents.length > 0) {
          gmEvents = detailedGmEvents;
          receivedGmEvents = detailedReceivedGmEvents;
        } else {
          gmEvents = Array.isArray(gmOps.gmEventsData) ? gmOps.gmEventsData : [];
          receivedGmEvents = Array.isArray(gmOps.receivedGmEventsData) ? gmOps.receivedGmEventsData : [];
        }
      }
      
      const allEvents = [...streamEvents, ...gmEvents, ...receivedGmEvents];
      
      const supportedRecords = allEvents.filter(event => {
        if (!event.content) return false;
        
        const messageType = event.content.messageType || 'text';
        const supportedTypes = ['text', 'gif', 'voice'];
        
        return supportedTypes.includes(messageType);
      });
      
      const chatGroups = {};
      
      supportedRecords.forEach(event => {
        let chatPartner = '';
        if (event.sender === currentAccount) {
          chatPartner = event.recipient;
        } else if (event.recipient === currentAccount) {
          chatPartner = event.sender;
        }
        
        if (chatPartner) {
          if (!chatGroups[chatPartner]) {
            chatGroups[chatPartner] = [];
          }
          chatGroups[chatPartner].push({
            ...event,
            isSent: event.sender === currentAccount,
            timestamp: normalizeTimestamp(event.timestamp || Date.now().toString())
          });
        }
      });
      
      Object.keys(chatGroups).forEach(partner => {
        chatGroups[partner].sort((a, b) => normalizeTimestamp(b.timestamp) - normalizeTimestamp(a.timestamp));
      });
      
      const chatRecords = Object.keys(chatGroups).map(partner => {
        const messages = chatGroups[partner];
        const latestMessage = messages[0];
        
        if (!latestMessage || typeof latestMessage !== 'object') {
          return null;
        }
        
        const sanitizedLatestMessage = {
          ...latestMessage,
          content: latestMessage.content || '',
          timestamp: normalizeTimestamp(latestMessage.timestamp || Date.now().toString())
        };
        
        const sanitizedMessages = messages.map(msg => ({
          ...msg,
          content: msg.content || '',
          timestamp: normalizeTimestamp(msg.timestamp || Date.now().toString())
        }));
        
        const uniqueMessages = [];
        const seenMessages = new Set();
        sanitizedMessages.forEach(msg => {
          const key = `${msg.content}-${msg.timestamp}-${msg.isSent}`;
          if (!seenMessages.has(key)) {
            seenMessages.add(key);
            uniqueMessages.push(msg);
          }
        });
        
        return {
          partnerAddress: partner,
          latestMessage: sanitizedLatestMessage,
          messageCount: uniqueMessages.length,
          allMessages: uniqueMessages,
          lastTimestamp: sanitizedLatestMessage.timestamp
        };
      }).filter(record => record !== null);
      
      const pinnedContacts = [
        import.meta.env.VITE_WHITELIST_ADDRESS,
        import.meta.env.VITE_APP_ID
      ];
      const pinnedRecords = [];
      const regularRecords = [];

      pinnedContacts.forEach(contact => {
        const contactInfo = getContactInfo(contact, null, currentAccount, isMobile);
        pinnedRecords.push({
          partnerAddress: contact,
          latestMessage: {
            content: '',
            timestamp: Date.now(),
            isSent: false
          },
          messageCount: 0,
          allMessages: [],
          lastTimestamp: Date.now()
        });
      });
      
      
      chatRecords.forEach(record => {
        const formattedRecordAddress = formatAccountOwner(record.partnerAddress);
        const pinnedIndex = pinnedRecords.findIndex(pinned => {
          const formattedPinned = formatAccountOwner(pinned.partnerAddress);
          return formattedPinned === formattedRecordAddress;
        });
        
        if (pinnedIndex !== -1) {
          pinnedRecords[pinnedIndex] = record;
        } else {
          regularRecords.push(record);
        }
      });

      regularRecords.sort((a, b) => Number(b.lastTimestamp) - Number(a.lastTimestamp));
  
      const sortedChatRecords = [...pinnedRecords, ...regularRecords];
      
      setChatConversations(sortedChatRecords);
      
    } catch (error) {
      setChatConversations([]);
    }
  }, [currentAccount, gmOps, currentIsConnected]);

  const renderMessageContent = (message, shouldTruncate = true) => {
    try {
      if (!message || typeof message !== 'object') {
                        return <span className="text-sm mb-6 text-gray-500">[Invalid message]</span>;
                      }
      
      let messageData = message;
      if (message.__typename || message.data) {
        messageData = message.data || message;
      }
      
      let contentData = messageData.content;
      
      if (contentData && typeof contentData === 'object') {
        if (contentData.content) {
          contentData = contentData.content;
        } else if (contentData.text) {
          contentData = contentData.text;
        } else if (contentData.message) {
          contentData = contentData.message;
        } else if (Object.keys(contentData).length > 0) {
          const possibleFields = ['content', 'text', 'message', 'data', 'value'];
          for (const field of possibleFields) {
            if (contentData[field] !== undefined) {
              contentData = contentData[field];
              break;
            }
          }
          if (typeof contentData === 'object') {
            contentData = JSON.stringify(contentData);
          }
        }
      }
      
      const messageType = (messageData.content?.messageType || messageData.messageType || 'text').toString();
      let content = contentData || '';
      
      if (content && typeof content === 'object') {
        if (content.text) {
          content = content.text;
        } else if (content.content) {
          content = content.content;
        } else {
          content = JSON.stringify(content);
        }
      }
      
      content = String(content || '');

      
      switch (messageType) {
        case 'text':
          if (shouldTruncate && content.length > 30) {
            const displayText = content.substring(0, 30) + '...';
            return <span className="inline-block max-w-full break-all font-normal text-xs leading-[1.2rem]">{displayText}</span>;
          } else {
            const lines = content.split('\n');
            return (
              <div className="inline-block max-w-full break-all font-normal text-xs leading-[1.2rem]">
                {lines.map((line, index) => (
                  <div key={index} className="font-normal text-xs leading-[1.2rem]">
                    {line}
                    {index < lines.length - 1 && <br />}
                  </div>
                ))}
              </div>
            );
          }
          
        case 'gif':
          const isExpanded = expandedGif === content;
          if (shouldTruncate) {
            return (
              <div className="flex justify-start items-center">
                <img 
                  src={content} 
                  alt="GIF Thumbnail" 
                  className="w-9 h-6 object-cover rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <div className="flex flex-col items-center justify-center w-12" style={{display: 'none'}}>
                  <span className="text-2xl mb-1 drop-shadow-md">🖼️</span>
                  <span>GIF</span>
                </div>
              </div>
            );
          }
          return (
            <div className="flex flex-col items-center gap-2 p-2" style={{background: 'none !important', border: 'none !important', borderRadius: '0 !important', padding: '0 !important', margin: '0 !important'}}>
              <div 
                className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-300 ${isExpanded ? '' : ''}`}
                onClick={() => toggleGifExpansion(content)}
              >
                {isExpanded ? (
                  <img 
                    src={content} 
                    alt="GIF" 
                    className="max-w-full h-auto rounded-lg"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                ) : (
                  <img 
                    src={content} 
                    alt="GIF Thumbnail" 
                    className="w-30 h-20 object-cover rounded-lg transition-all duration-300 hover:scale-105"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                )}
              </div>
              {isExpanded && (
                <div className="flex justify-center mt-2">
                  <button 
                    className="bg-[rgba(255,107,53,0.8)] border-none text-white text-base w-6 h-6 rounded-full cursor-pointer flex items-center justify-center transition-transform duration-200 hover:bg-[#ff6b35] hover:scale-110"
                    onClick={() => toggleGifExpansion(null)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
          
        case 'voice':
          const voiceId = `${message.sender}-${message.timestamp}`;
          const isPlaying = playingVoice === voiceId;
          const audio = audioElements[voiceId];
          const duration = audio ? Math.round(audio.duration) : 3;
          
          if (shouldTruncate) {
            return (
              <div className="flex justify-start items-center text-sm">
                <div className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded-lg">
                  <span className="text-sm mr-1">🔊</span>
                  <div className="flex items-center gap-[2px] h-5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div 
                        key={i} 
                        className="w-1.5 bg-gray-500 rounded-full"
                        style={{
                          height: `${20 + i * 4}%`
                        }}
                      ></div>
                    ))}
                  </div>
                  <span className="text-xs leading-[1.2rem]">{duration}"</span>
                </div>
              </div>
            );
          }
          const currentTime = audio ? Math.round(audio.currentTime) : 0;
          const progress = audio && duration > 0 ? (currentTime / duration) * 100 : 0;
          
          return (
            <div className={`flex flex-col w-full max-w-[80%] ${isPlaying ? '' : ''}`}>
              <div className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => playVoice(voiceId, content)}>
                <div className="text-xs leading-[1.2rem] text-inherit min-w-[30px] text-center">{isPlaying ? `${duration - currentTime}"` : `${duration}"`}</div>
                <div className="flex items-center gap-[2px] h-6 flex-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div 
                      key={i} 
                      className={`w-1.5 bg-gray-300 rounded-full transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`}
                      style={{
                        height: isPlaying ? `${Math.random() * 100}%` : '40%',
                        animationDelay: `${i * 0.1}s`
                      }}
                    ></div>
                  ))}
                </div>
                <div className={`min-w-[20px] text-center ${isPlaying ? '' : ''}`}>
                  {isPlaying ? '🔊' : '▶️'}
                </div>
              </div>
              {isPlaying && (
                <div className="h-1 bg-white/20 rounded-full overflow-hidden relative mt-1">
                  <div 
                    className="h-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c42] rounded-full transition-all duration-100" 
                    style={{width: `${progress}%`}}
                  ></div>
                </div>
              )}
            </div>
          );
          
        default:
          return <span className="text-red-500">[Unknown message type: {messageType}]</span>;
      }
    } catch (error) {
      return <span className="text-red-500 text-center p-2 text-xs leading-[1.2rem]">[Error displaying message]</span>;
    }
  };

  if (!currentAccount) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm min-h-[350px] max-h-[350px] overflow-hidden relative">
        <div className="flex items-center justify-center h-[270px]">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center text-blue-600">
            <div className="text-[#5d4037] text-sm leading-[1.4]">
              Please connect wallet to view chat history
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isInChatView = currentChatPartner && currentChatPartner !== '' && currentChatPartner !== null && currentChatPartner !== undefined;
  
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm min-h-[350px] max-h-[350px] overflow-hidden relative">

      <div className="bg-gradient-to-br from-white to-[#fdf6f3] rounded-xl shadow-[0_2px_8px_rgba(255,42,0,0.1)] flex flex-col gap-2">
        {chatConversations.length === 0 ? (
          <div className="flex items-center justify-center h-[270px]">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center text-blue-600">
              <div className="text-[#5d4037] text-sm leading-[1.4]">
                No chat history yet, please select a contact to start chatting
              </div>
            </div>
          </div>
        ) : (
          chatConversations.map((chat) => {
            const isExpanded = expandedChats[chat.partnerAddress];
            const latestMessage = chat.latestMessage;            
            const hasAnyExpanded = Object.keys(expandedChats).length > 0;
            if (hasAnyExpanded && !isExpanded) {
              return null;
            }
            
            if (!chat || typeof chat !== 'object') {
              return null;
            }
            
            if (!chat.partnerAddress || typeof chat.partnerAddress !== 'string') {
              return null;
            }
            
            if (!chat.latestMessage || typeof chat.latestMessage !== 'object') {
              return null;
            }
            

            
            const renderAvatar = (avatar) => {
              if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
                return <img src={avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />;
              }
              return <span className="text-xl">{avatar}</span>;
            };
            
            const contactInfo = getContactInfo(chat.partnerAddress, latestMessage, currentAccount, isMobile);

            
            return (
              <div 
                key={chat.partnerAddress} 
                className={`bg-transparent border border-gray-200 rounded-lg p-2 px-3 transition-all duration-300 opacity-100 scale-100 ${isExpanded ? 'bg-gradient-to-br from-white to-[#f8f5ed]' : ''} ${hasAnyExpanded && !isExpanded ? 'opacity-0 scale-95 h-0 p-0 m-0 overflow-hidden border-0' : ''}`}
              >
                <div 
                  className="p-2 cursor-pointer rounded-md hover:bg-gray-50"
                  onClick={() => toggleChatExpansion(chat.partnerAddress)}
                >
                  <div className="flex justify-between items-center text-xs leading-[1.2rem] relative gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="text-base flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 overflow-hidden">{renderAvatar(contactInfo.avatar)}</span>
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-nowrap">
                          <span className="text-gray-600 flex-shrink-0 text-sm font-normal">
                            {contactInfo.name || formatAddressForDisplay(chat.partnerAddress)}
                          </span>
                          {contactInfo.name && (
                            <span className="text-gray-500 text-xs leading-[1.2rem] flex-1 text-left">
                              :{chat.partnerAddress.substring(0, 6)}...{chat.partnerAddress.substring(chat.partnerAddress.length - 4)}
                            </span>
                          )}
                        </div>
                        <div className="text-sm truncate">
                          {latestMessage && typeof latestMessage === 'object' ? renderMessageContent(latestMessage, true) : <span className="text-red-500">[Invalid message]</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-gray-500 text-xs leading-[1.2rem] flex-shrink-0">
                        {new Date(normalizeTimestamp(latestMessage.timestamp)).toLocaleDateString()} {new Date(normalizeTimestamp(latestMessage.timestamp)).toLocaleTimeString()}
                      </span>
                      <span className="text-gray-500 text-xs leading-[1.2rem] flex-shrink-0 mr-2">
                        {chat.messageCount} 💬
                      </span>
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-[rgba(255,90,0,0.3)] animate-fadeIn bg-transparent max-h-[270px] overflow-y-auto">
                    {chat.allMessages.map((message, msgIndex) => {
                      const isSent = message.isSent;
                      const senderAddress = isSent ? currentAccount : chat.partnerAddress;
                      
                      if (!senderAddress || typeof senderAddress !== 'string') {
                        return null;
                      }
                      
                      const senderContactInfo = getContactInfo(senderAddress, message, currentAccount, isMobile);
                      const displayAddress = `${senderAddress.substring(0, 6)}...${senderAddress.substring(senderAddress.length - 4)}`;
                      
                      let senderLabel;
                      if (senderContactInfo.name && senderContactInfo.name !== '') {
                          senderLabel = senderContactInfo.name;
                      } else if (isSent) {
                          senderLabel = 'Me';
                      } else if (formatAccountOwner(senderAddress) === formatAccountOwner(import.meta.env.VITE_APP_ID)) {
                          senderLabel = 'GMIC Bot';
                      } else {
                          senderLabel = 'Friend';
                      }
                      
                      const displayName = senderLabel;

                      let messageType = 'text';
                      if (message.content?.messageType) {
                        messageType = message.content.messageType;
                      } else if (message.messageType) {
                        messageType = message.messageType;
                      }
                      messageType = messageType.toString();
                      
                      const useMessageBubble = messageType === 'text';
                      
                      return (
                        <div 
                          key={msgIndex} 
                          className={`flex items-start mb-4 px-2 mt-[5px] ${isSent ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isSent && (
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-2 flex-shrink-0 overflow-hidden">
                              {renderAvatar(senderContactInfo.avatar)}
                            </div>
                          )}
                          
                          <div className="max-w-[70%] flex flex-col">
                            <div className="flex items-center mb-1 text-xs text-gray-500">
                              <span className="mr-2">{displayName}</span>
                              <span className="text-[0.7rem]">
                                {new Date(normalizeTimestamp(message.timestamp)).toLocaleDateString()} {new Date(normalizeTimestamp(message.timestamp)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            {useMessageBubble ? (
                              <div className={`${isSent ? 'bg-[#95ec69] text-black rounded-xl p-1.5 px-2.5 break-words relative shadow-[0_2px_4px_rgba(149,236,105,0.3)]' : 'bg-gray-100 border border-gray-200 rounded-xl p-1.5 px-2.5 break-words relative'}`}>
                                {renderMessageContent(message, false)}
                              </div>
                            ) : (
                              <div className="flex justify-center items-center">
                                {renderMessageContent(message, false)}
                              </div>
                            )}
                          </div>
                          
                          {isSent && (
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-2 flex-shrink-0 overflow-hidden">
                              {renderAvatar(senderContactInfo.avatar)}
                            </div>
                          )}
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatHistory;