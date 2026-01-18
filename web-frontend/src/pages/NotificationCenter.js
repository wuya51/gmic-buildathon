import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';

const NotificationCenter = ({ 
  notifications, 
  onRemoveNotification, 
  gmRecords, 
  currentAccount, 
  gmOperations, 
  chainId,
  isLoading = false,
  error = null 
}) => {
  const prevGmRecordsRef = useRef([]);
  const isInitialLoadRef = useRef(true);
  
  const [activeBalls, setActiveBalls] = useState([]);
  const [lastQueryTime, setLastQueryTime] = useState(0);
  const [queryInterval, setQueryInterval] = useState(null);


  const formatShortAddress = useCallback((address) => {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  }, []);

  const normalizeTimestamp = useCallback((timestamp) => {
    if (!timestamp) return 0;
    
    let num = Number(timestamp);
    if (isNaN(num)) {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
      return 0;
    }
    
    const currentTime = Date.now();
    const reasonableStart = new Date('2020-01-01').getTime();
    const reasonableEnd = new Date('2030-01-01').getTime();
    
    try {
      const bigNum = BigInt(timestamp);

      if (bigNum > 1000000000000000n) {
        const result = Number(bigNum / 1000000n);
        if (result > reasonableStart && result < reasonableEnd) {
          return result;
        }
      }

      if (bigNum > 1000000000000n && bigNum < 1000000000000000n) {
        const result = Number(bigNum / 1000n);
        if (result > reasonableStart && result < reasonableEnd) {
          return result;
        }
      }
    } catch (e) {
    }

    const len = num.toString().length;
    if (len <= 12) {
      const result = num * 1000;
      if (result > reasonableStart && result < reasonableEnd) {
        return result;
      }
    } else if (len > 16) {
      const result = num / 1000000;
      if (result > reasonableStart && result < reasonableEnd) {
        return result;
      }
    } else {
      const result = len > 13 ? num / 1000 : num;
      if (result > reasonableStart && result < reasonableEnd) {
        return result;
      }
    }
    
    return 0;
  }, []);

  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '';
    const date = new Date(normalizeTimestamp(timestamp));
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, [normalizeTimestamp]);

  const getRandomPosition = useCallback(() => ({
    left: Math.floor(Math.random() * 280) + 20,
    bottom: Math.floor(Math.random() * 180) + 20
  }), []);

  const memoizedNotifications = useMemo(() => 
    Array.isArray(notifications) ? notifications : [],
    [notifications]
  );







  useEffect(() => {
    return () => {
      activeBalls.forEach(ball => clearTimeout(ball.removeTimer));
      if (queryInterval) clearInterval(queryInterval);
    };
  }, [activeBalls, queryInterval]);


  useEffect(() => {
    if (!gmOperations || !currentAccount) return;

    const handleSubscriptionEvent = () => {
      const now = Date.now();
      if (now - lastQueryTime < 5000) return;

      setLastQueryTime(now);
      Promise.allSettled([
        gmOperations.refetchGmEvents?.(),
        gmOperations.refetchStreamEvents?.(),
        gmOperations.refetchWalletMessages?.()
      ]);
    };

    const interval = setInterval(handleSubscriptionEvent, 10000);
    setQueryInterval(interval);

    return () => {
      clearInterval(interval);
      if (queryInterval) clearInterval(queryInterval);
    };
  }, [gmOperations, currentAccount, lastQueryTime]);


  useEffect(() => {
    if (!Array.isArray(gmRecords) || !gmRecords.length) return;

    if (isInitialLoadRef.current && gmRecords.length > 3) {
      isInitialLoadRef.current = false;
      prevGmRecordsRef.current = [...gmRecords];
      return;
    }
    
    isInitialLoadRef.current = false;

    const prevRecords = Array.isArray(prevGmRecordsRef.current) ? prevGmRecordsRef.current : [];
    const prevIds = new Set(prevRecords.map(r => `${r.sender || 'unknown'}-${r.timestamp || '0'}`));
    
    const newRecords = gmRecords.filter(r => {
      if (!r || typeof r !== 'object') return false;
      const recordId = `${r.sender || 'unknown'}-${r.timestamp || '0'}`;
      return !prevIds.has(recordId);
    });
    
    prevGmRecordsRef.current = [...gmRecords];

    newRecords.forEach((record, index) => {
      if (!record || !record.sender) return;
      
      const position = getRandomPosition();
      const recordId = `${record.sender}-${record.timestamp || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setActiveBalls(prev => {
        if (prev.some(b => b.id === recordId)) return prev;

        const removeTimer = setTimeout(() => {
          setActiveBalls(p => p.filter(b => b.id !== recordId));
        }, 5000);

        return [...prev, {
          id: recordId,
          sender: record.sender,
          timestamp: new Date().toLocaleTimeString(),
          position,
          visible: true,
          removeTimer
        }];
      });
    });


  }, [gmRecords, currentAccount, getRandomPosition]);

  return (
    <>
      {isLoading && (
        <div className="fixed bottom-2 right-2 z-[10000] flex items-center gap-[0.3rem] p-[0.3rem_0.6rem_0.2rem_0.6rem] bg-white/95 rounded-md shadow-[0_3px_10px_rgba(0,0,0,0.15)] text-gray-600 text-xs backdrop-blur-md">
          <div className="w-3 h-3 border-2 border-gray-200 border-t-[#ff2a00] rounded-full animate-spin"></div>
          <span>Loading notifications...</span>
        </div>
      )}

      {error && (
        <div className="fixed bottom-2 right-2 z-[10000] flex items-center gap-[0.3rem] p-[0.3rem_0.6rem_0.2rem_0.6rem] bg-[rgba(231,76,60,0.95)] rounded-md shadow-[0_3px_10px_rgba(0,0,0,0.15)] text-white text-xs backdrop-blur-md">
          <span className="error-icon text-sm">⚠️</span>
          <span>Failed to load notifications: {error}</span>
          <button className="bg-white/20 border border-white/30 rounded p-[0.2rem_0.5rem] text-white text-[0.65rem] cursor-pointer transition-all duration-200 hover:bg-white/30">Retry</button>
        </div>
      )}

      <div className="fixed bottom-2 right-2 z-[1000] flex flex-col gap-[0.4rem] max-w-[320px]">
        {memoizedNotifications.map(notification => (
          <div 
            key={notification.id} 
            className={`p-[0.3rem_0.6rem_0.2rem_0.6rem] rounded-md border border-transparent shadow-[0_3px_10px_rgba(0,0,0,0.15)] cursor-pointer transition-all duration-400 animate-slideInRight origin-right relative pr-[1.6rem] ${notification.type === 'error' ? 'bg-gradient-to-br from-[rgba(231,76,60,0.95)] to-[rgba(192,57,43,0.95)] border-[#c0392b] text-white border-l-[6px] border-l-[#e74c3c]' : ''} ${notification.type === 'success' ? 'bg-gradient-to-br from-[rgba(46,204,113,0.95)] to-[rgba(39,174,96,0.95)] border-[#27ae60] text-white border-l-[6px] border-l-[#2ecc71]' : ''} ${notification.type === 'warning' ? 'bg-gradient-to-br from-[rgba(241,196,15,0.95)] to-[rgba(243,156,18,0.95)] border-[#f39c12] text-white border-l-[6px] border-l-[#f1c40f]' : ''} ${notification.type === 'info' ? 'bg-gradient-to-br from-[rgba(52,152,219,0.95)] to-[rgba(41,128,185,0.95)] border-[#2980b9] text-white border-l-[6px] border-l-[#3498db]' : ''}`}
          >
            <div className="flex-1 flex flex-col justify-between mr-[0.5rem] min-w-0 pb-[0.1rem]">
              <span className="text-xs font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {notification.type === 'success' ? '✓ ' : ''}{notification.message}
              </span>
              <span className="text-[0.55rem] opacity-50 whitespace-nowrap self-end leading-none mb-[-0.1rem]">
                {new Date(notification.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <button
              className="absolute top-[0.15rem] right-[0.2rem] bg-black/20 border-none text-white text-[0.7rem] cursor-pointer w-[14px] h-[14px] flex items-center justify-center rounded-full transition-all duration-300 backdrop-blur-md hover:bg-[rgba(255,42,0,0.8)]"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveNotification(notification.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 z-[9999] pointer-events-none">
        {activeBalls.map(ball => (
          <div
            key={ball.id}
            className={`absolute w-[120px] h-[120px] rounded-full bg-gradient-to-br from-white/90 to-[rgba(255,182,193,0.7)] border-2 border-white/90 shadow-[0_4px_15px_rgba(255,42,0,0.3),0_0_30px_rgba(255,42,0,0.4),inset_0_0_20px_rgba(255,255,255,0.5)] flex items-center justify-center text-[#2c3e50] font-semibold text-center cursor-pointer transition-all duration-300 hover:shadow-[0_6px_25px_rgba(255,42,0,0.6)] animate-floatUp pointer-events-auto ${ball.visible ? 'visible' : 'hidden'}`}
            style={{ left: `${ball.position.left}px`, bottom: `${ball.position.bottom}px` }}
            onMouseEnter={(e) => e.currentTarget.style.animationPlayState = 'paused'}
            onMouseLeave={(e) => e.currentTarget.style.animationPlayState = 'running'}
          >
            <div className="flex flex-col items-center gap-0.5">
              <div className="text-xs font-semibold opacity-100 text-[#ff2a00] text-shadow-[0_0_8px_rgba(255,42,0,0.6)] border-none">{formatShortAddress(ball.sender)}</div>
              <div className="text-xs font-bold">Sent GMIC</div>
              <div className="text-sm font-extrabold text-[#ff2a00]">+1</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default NotificationCenter;