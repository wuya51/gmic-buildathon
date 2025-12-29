import React, { useState, useEffect } from 'react';
import './UserProfile.css';

export const DEFAULT_CONTACTS = {
  '0xfe609ad118ba733dafb3ce2b6094c86a441b10de4ffd1651251fffe973efd959': {
    username: 'User',
    avatar: null
  },
  'wuya51': {
    username: 'wuya51',
    avatar: null
  },
  'GMic': {
    username: 'GMic',
    avatar: null
  }
};

const UserProfile = ({ address, userData = {}, onChainUserData = {}, showAddress = true, size = 40, truncateAddress = true, className = '' }) => {
  const getUserInfo = () => {

    if (onChainUserData && onChainUserData.username) {
      return onChainUserData;
    }

    if (userData && userData.username) {
      return userData;
    }

    if (address) {
      const lowerAddress = address.toLowerCase();
      if (DEFAULT_CONTACTS[lowerAddress]) {
        return DEFAULT_CONTACTS[lowerAddress];
      }

      try {
        const storedProfiles = JSON.parse(localStorage.getItem('userProfiles') || '{}');
        if (storedProfiles[address]) {
          return storedProfiles[address];
        }
      } catch (error) {
        console.error('Error fetching stored user data:', error);
      }
    }

    return {
      username: address || '',
      avatar: null
    };
  };

  const userInfo = getUserInfo() || { username: '', avatar: null };
  
  const formatDisplayAddress = (addr) => {
    if (!showAddress) return '';
    if (!addr || typeof addr !== 'string') return '';
    if (!truncateAddress || addr.length <= 10) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className={`user-profile ${className}`}>
      <div 
        className="user-avatar" 
        style={{ 
          width: size, 
          height: size,
          borderRadius: size / 2,
          fontSize: size * 0.4
        }}
      >
        {userInfo.avatar ? (
          <img 
            src={userInfo.avatar} 
            alt={`${userInfo.username}'s avatar`} 
            className="avatar-image"
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <div 
            className="avatar-placeholder"
            style={{ 
              width: size, 
              height: size,
              borderRadius: size / 2,
              lineHeight: `${size}px`,
              fontSize: size * 0.4
            }}
          >
            {userInfo.username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {userInfo.username && (
        <div className="user-info">
          <div className="user-username">{userInfo.username}</div>
          {showAddress && (
            <div className="user-address">{formatDisplayAddress(address)}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;