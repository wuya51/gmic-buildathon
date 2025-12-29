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
        <div className="notification-loading">
          <div className="loading-spinner"></div>
          <span>Loading notifications...</span>
        </div>
      )}

      {error && (
        <div className="notification-error">
          <span className="error-icon">⚠️</span>
          <span>Failed to load notifications: {error}</span>
          <button className="retry-btn" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      <div className="notifications-container">
        {memoizedNotifications.map(notification => (
          <div key={notification.id} className={`notification notification-${notification.type}`}>
            <div className="notification-content">
              <span className="notification-message">
                {notification.type === 'success' ? '✓ ' : ''}{notification.message}
              </span>
              <span className="notification-timestamp">
                {new Date(notification.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <button
              className="notification-close"
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

      <div className="gm-notification-container">
        {activeBalls.map(ball => (
          <div
            key={ball.id}
            className={`gm-notification-ball ${ball.visible ? 'visible' : 'hidden'}`}
            style={{ left: `${ball.position.left}px`, bottom: `${ball.position.bottom}px` }}
          >
            <div className="ball-content">
              <div className="sender-address">{formatShortAddress(ball.sender)}</div>
              <div className="action-text">Sent GMIC</div>
              <div className="plus-one">+1</div>
            </div>
          </div>
        ))}
      </div>


    </>
  );
};

export default NotificationCenter;