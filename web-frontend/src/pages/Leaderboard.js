import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLeaderboardData } from '../services/GMOperations';
import { formatAddressForDisplay } from '../utils/utils';

const Leaderboard = React.memo(({ currentAccount, isMobile, copyToClipboard }) => {
  const { leaderboardData, invitationLeaderboardData, refetchLeaderboard, refetchInvitationLeaderboard, getUserProfile } = useLeaderboardData();
  const stableLeaderboardData = useMemo(() => {
    if (!leaderboardData) return null;
    return JSON.parse(JSON.stringify(leaderboardData));
  }, [JSON.stringify(leaderboardData)]);
  const stableInvitationLeaderboardData = useMemo(() => {
    if (!invitationLeaderboardData) return null;
    return JSON.parse(JSON.stringify(invitationLeaderboardData));
  }, [JSON.stringify(invitationLeaderboardData)]);
  const stableRefetchLeaderboard = useCallback(() => {
    refetchLeaderboard && refetchLeaderboard();
  }, []);
  
  const stableRefetchInvitationLeaderboard = useCallback(() => {
    refetchInvitationLeaderboard && refetchInvitationLeaderboard();
  }, []);

  useEffect(() => {
    if (refetchLeaderboard) {
      refetchLeaderboard();
    }
    if (refetchInvitationLeaderboard) {
      refetchInvitationLeaderboard();
    }
  }, []);

  const gmLeaderboardItems = useMemo(() => {
    if (!stableLeaderboardData?.getTopUsers || stableLeaderboardData.getTopUsers.length === 0) {
      return null;
    }
    
    return stableLeaderboardData.getTopUsers.map((entry, index) => {
      const userProfile = getUserProfile ? getUserProfile(entry.user) : null;
      const formattedAddress = formatAddressForDisplay(entry.user, isMobile);
      const displayName = userProfile?.name ? `${userProfile.name}: ${formattedAddress}` : formattedAddress;
      const avatarUrl = userProfile?.avatar || null;

      return (
        <tr key={`user-${entry.user}`} data-user={entry.user} className={`transition-all duration-200 ${entry.user === currentAccount ? 'bg-[rgba(255,42,0,0.1)] font-semibold' : 'hover:bg-[rgba(255,42,0,0.05)] hover:shadow-sm'}`}>
          <td className="p-3 border-b border-gray-100 text-gray-700">{index + 1}</td>
          <td className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {avatarUrl ? 
                <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover transition-all duration-300 hover:scale-110 hover:shadow-md hover:shadow-[rgba(255,42,0,0.3)]" /> : 
                <span className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600 transition-all duration-300 hover:scale-110 hover:shadow-md hover:shadow-[rgba(255,42,0,0.3)]">👤</span>
              }
              {userProfile?.name ? (
                <div className="flex flex-col">
                  <span className="text-gray-800 font-medium">{userProfile.name}</span>
                  <span
                    className="text-gray-600 text-sm font-normal cursor-pointer px-1 py-0.5 rounded transition-all duration-200 hover:bg-[rgba(255,42,0,0.1)] hover:text-[#ff2a00]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyToClipboard(entry.user, e);
                    }}
                    title={entry.user}
                  >
                    {formattedAddress}
                  </span>
                </div>
              ) : (
                <span
                  className="text-gray-800 font-normal cursor-pointer px-1 py-0.5 rounded transition-all duration-200 hover:bg-[rgba(255,42,0,0.1)] hover:text-[#ff2a00]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyToClipboard(entry.user, e);
                  }}
                  title={entry.user}
                >
                  {formattedAddress}
                </span>
              )}
            </div>
          </td>
          <td className="p-3 border-b border-gray-100 text-gray-800">{entry.count}</td>
        </tr>
      );
    });
  }, [stableLeaderboardData?.getTopUsers, currentAccount, isMobile, copyToClipboard, getUserProfile]);
  
  const invitationLeaderboardItems = useMemo(() => {
    if (!stableInvitationLeaderboardData?.getTopInvitors || stableInvitationLeaderboardData.getTopInvitors.length === 0) {
      return null;
    }
    
    return stableInvitationLeaderboardData.getTopInvitors.map((entry, index) => {
      const userProfile = getUserProfile ? getUserProfile(entry.user) : null;
      const formattedAddress = formatAddressForDisplay(entry.user, isMobile);
      const displayName = userProfile?.name ? `${userProfile.name}: ${formattedAddress}` : formattedAddress;
      const avatarUrl = userProfile?.avatar || null;

      return (
        <tr key={`invitor-${entry.user}`} data-user={entry.user} className={`transition-all duration-200 ${entry.user === currentAccount ? 'bg-[rgba(255,42,0,0.1)] font-semibold' : 'hover:bg-[rgba(255,42,0,0.05)] hover:shadow-sm'}`}>
          <td className="p-3 border-b border-gray-100 text-gray-700">{index + 1}</td>
          <td className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {avatarUrl ? 
                <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover transition-all duration-300 hover:scale-110 hover:shadow-md hover:shadow-[rgba(255,42,0,0.3)]" /> : 
                <span className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600 transition-all duration-300 hover:scale-110 hover:shadow-md hover:shadow-[rgba(255,42,0,0.3)]">👤</span>
              }
              {userProfile?.name ? (
                <div className="flex flex-col">
                  <span className="text-gray-800 font-medium">{userProfile.name}</span>
                  <span
                    className="text-gray-600 text-sm font-normal cursor-pointer px-1 py-0.5 rounded transition-all duration-200 hover:bg-[rgba(255,42,0,0.1)] hover:text-[#ff2a00]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyToClipboard(entry.user, e);
                    }}
                    title={entry.user}
                  >
                    {formattedAddress}
                  </span>
                </div>
              ) : (
                <span
                  className="text-gray-800 font-normal cursor-pointer px-1 py-0.5 rounded transition-all duration-200 hover:bg-[rgba(255,42,0,0.1)] hover:text-[#ff2a00]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyToClipboard(entry.user, e);
                  }}
                  title={entry.user}
                >
                  {formattedAddress}
                </span>
              )}
            </div>
          </td>
          <td className="p-3 border-b border-gray-100 text-gray-800">{entry.count}</td>
        </tr>
      );
    });
  }, [stableInvitationLeaderboardData?.getTopInvitors, currentAccount, isMobile, copyToClipboard, getUserProfile]);

  return (
    <div className="w-full relative mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Leaderboard</h3>
      </div>
      <div className="mt-4">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-medium text-gray-700">Top GMicrochains Senders</h4>
              <button 
                className="bg-transparent border-0 text-[#ff2a00] text-sm cursor-pointer p-1 rounded transition-all duration-300 hover:bg-[rgba(255,42,0,0.1)]"
                onClick={stableRefetchLeaderboard}
                title="Refresh leaderboard"
              >
                🔄 Refresh
              </button>
            </div>
            {gmLeaderboardItems ? (
              <div>
                <table className="w-full border-collapse text-sm font-sans">
                  <thead>
                    <tr className="bg-[rgba(255,42,0,0.05)]">
                      <th className="p-3 text-left font-bold text-[#ff2a00] w-[60px] tracking-wide">Rank</th>
                      <th className="p-3 text-left font-bold text-[#ff2a00] w-full min-w-[250px] tracking-wide">User</th>
                      <th className="p-3 text-left font-bold text-[#ff2a00] w-[80px] tracking-wide">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gmLeaderboardItems}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-4 text-gray-500">
                <p>No leaderboard data available yet.</p>
              </div>
            )}
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-medium text-gray-700">Top Invitors</h4>
              <button 
                className="bg-transparent border-0 text-[#ff2a00] text-sm cursor-pointer p-1 rounded transition-all duration-300 hover:bg-[rgba(255,42,0,0.1)]"
                onClick={stableRefetchInvitationLeaderboard}
                title="Refresh invitation leaderboard"
              >
                🔄 Refresh
              </button>
            </div>
            {invitationLeaderboardItems ? (
              <div>
                <table className="w-full border-collapse text-sm font-sans">
                  <thead>
                    <tr className="bg-[rgba(255,42,0,0.05)]">
                      <th className="p-3 text-left font-bold text-[#ff2a00] w-[60px] tracking-wide">Rank</th>
                      <th className="p-3 text-left font-bold text-[#ff2a00] w-full min-w-[250px] tracking-wide">User</th>
                      <th className="p-3 text-left font-bold text-[#ff2a00] w-[80px] tracking-wide">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitationLeaderboardItems}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-4 text-gray-500">
                <p>No invitation leaderboard data available yet.</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.currentAccount !== nextProps.currentAccount) {
    return false;
  }
  if (prevProps.isMobile !== nextProps.isMobile) {
    return false;
  }
  return true;
});

export default Leaderboard;