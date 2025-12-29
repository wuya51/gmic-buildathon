import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLeaderboardData } from '../services/GMOperations';

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
      const shortAddress = `${entry.user.slice(0, 6)}...${entry.user.slice(-4)}`;
      const displayName = userProfile?.name ? `${userProfile.name}: ${shortAddress}` : shortAddress;
      const avatarUrl = userProfile?.avatar || null;

      return (
        <tr key={`user-${entry.user}`} data-user={entry.user} className={entry.user === currentAccount ? "current-user" : ""}>
          <td>{index + 1}</td>
          <td>
            <div className="user-info">
              {avatarUrl && <img src={avatarUrl} alt="avatar" className="user-avatar" />}
              <span
                className="address-simple"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyToClipboard(entry.user, e);
                }}
              >
                {displayName}
              </span>
            </div>
          </td>
          <td>{entry.count}</td>
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
      const shortAddress = `${entry.user.slice(0, 6)}...${entry.user.slice(-4)}`;
      const displayName = userProfile?.name ? `${userProfile.name}: ${shortAddress}` : shortAddress;
      const avatarUrl = userProfile?.avatar || null;

      return (
        <tr key={`invitor-${entry.user}`} data-user={entry.user} className={entry.user === currentAccount ? "current-user" : ""}>
          <td>{index + 1}</td>
          <td>
            <div className="user-info">
              {avatarUrl && <img src={avatarUrl} alt="avatar" className="user-avatar" />}
              <span
                className="address-simple"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyToClipboard(entry.user, e);
                }}
              >
                {displayName}
              </span>
            </div>
          </td>
          <td>{entry.count}</td>
        </tr>
      );
    });
  }, [stableInvitationLeaderboardData?.getTopInvitors, currentAccount, isMobile, copyToClipboard, getUserProfile]);

  return (
    <div className="card leaderboard-card">
      <div className="section-header">
        <h3>Leaderboard</h3>
      </div>
      <div className="leaderboard-content">
          <div className="leaderboard-tabs">
            <div className="stats-header">
              <h4>Top GMicrochains Senders</h4>
              <button 
                className="refresh-btn"
                onClick={stableRefetchLeaderboard}
                title="Refresh leaderboard"
              >
                🔄 Refresh
              </button>
            </div>
            {gmLeaderboardItems ? (
              <div className="leaderboard-list">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>User</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gmLeaderboardItems}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-leaderboard-data">
                <p>No leaderboard data available yet.</p>
              </div>
            )}
          </div>
          
          <div className="leaderboard-tabs invitation-leaderboard-tab">
            <div className="stats-header">
              <h4>Top Invitors</h4>
              <button 
                className="refresh-btn"
                onClick={stableRefetchInvitationLeaderboard}
                title="Refresh invitation leaderboard"
              >
                🔄 Refresh
              </button>
            </div>
            {invitationLeaderboardItems ? (
              <div className="leaderboard-list">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>User</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitationLeaderboardItems}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-leaderboard-data">
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