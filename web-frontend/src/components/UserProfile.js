import React, { useState, useEffect } from 'react';

export const DEFAULT_CONTACTS = {
  [import.meta.env.VITE_WHITELIST_ADDRESS]: {
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

const UserProfile = ({ address, userData = {}, onChainUserData = {}, showAddress = true, size = 40, truncateAddress = true, onEditProfile = null, className = '' }) => {
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
    <div className={`flex items-center ${className}`}>
      <div className="flex items-center gap-3 sm:gap-2">
        <div 
          className="rounded-full overflow-hidden bg-gray-100 flex justify-center items-center flex-shrink-0" 
          style={{ 
            width: size, 
            height: size,
            fontSize: size * 0.4
          }}
        >
          {userInfo.avatar ? (
            <img 
              src={userInfo.avatar} 
              alt={`${userInfo.username}'s avatar`} 
              className="w-full h-full object-cover rounded-full"
              style={{ width: size, height: size, borderRadius: size / 2 }}
            />
          ) : (
            <div 
              className="w-full h-full flex justify-center items-center bg-gray-200 text-gray-500 font-semibold"
              style={{ 
                lineHeight: `${size}px`,
                fontSize: size * 0.4
              }}
            >
              {userInfo.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {userInfo.username && (
          <div className="flex flex-col justify-center min-w-0">
            <div className="font-normal text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis sm:text-sm">{userInfo.username}</div>
            {showAddress && (
              <div className="text-xs text-gray-500 font-mono whitespace-nowrap overflow-hidden text-ellipsis">{formatDisplayAddress(address)}</div>
            )}
          </div>
        )}
      </div>
      {onEditProfile && (
        <button 
          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-sm font-medium"
          onClick={onEditProfile}
        >
          Edit Profile
        </button>
      )}
    </div>
  );
};

export default UserProfile;