import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.webp';
import './TopNavbar.css';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api';

const TopNavbar = ({ userRole, onLogout }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotifs, setLatestNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Get user info from localStorage
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const userName = currentUser.full_name || currentUser.username || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const roleLabel = userRole === 'admin' ? 'Administrator' : userRole === 'librarian' ? 'Librarian' : 'Library Member';

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll for notifications
  useEffect(() => {
    let cancelled = false;
    const fetchNotifs = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        const data = await getNotifications();
        if (!cancelled) {
          setUnreadCount(data.filter(n => !n.read).length);
          setLatestNotifs(data.slice(0, 5));
        }
      } catch (_) { 
        console.error("Failed to fetch notifications.");
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 120000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      setLatestNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) { 
      console.error("Failed to mark notification as read.");
    }
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    try {
      await markAllNotificationsRead();
      setLatestNotifs(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (_) { 
      console.error("Failed to mark all notifications as read.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    if (onLogout) onLogout();
    navigate('/');
  };

  return (
    <header className="top-navbar">
      {/* Left section moved to Sidebar */}
      <div></div>

      {/* Right: Actions */}
      <div className="topnav-right">
        {/* Notification Bell */}
        <div className="topnav-action-wrapper" ref={notifRef}>
          <button
            className="topnav-icon-btn"
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="topnav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {/* Notification Dropdown */}
          {notifOpen && (
            <div className="topnav-dropdown notif-dropdown">
              <div className="topnav-dropdown-header">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <button className="topnav-clear-btn" onClick={handleMarkAllRead}>Mark all read</button>
                )}
              </div>
              <div className="topnav-dropdown-body">
                {latestNotifs.length === 0 ? (
                  <div className="topnav-dropdown-empty">No notifications</div>
                ) : (
                  latestNotifs.map(notif => (
                    <div
                      key={notif.id}
                      className={`topnav-notif-item ${notif.read ? '' : 'unread'}`}
                      onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                    >
                      <div className="topnav-notif-row">
                        <span className="topnav-notif-title">{notif.title}</span>
                        {!notif.read && (
                          <button className="topnav-notif-mark" onClick={(e) => handleMarkRead(notif.id, e)} title="Mark read">✓</button>
                        )}
                      </div>
                      <span className="topnav-notif-msg">{notif.message}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="topnav-dropdown-footer">
                <Link to="/notifications" onClick={() => setNotifOpen(false)}>View all notifications</Link>
              </div>
            </div>
          )}
        </div>

        {/* Profile Section */}
        <div className="topnav-action-wrapper" ref={profileRef}>
          <button
            className="topnav-profile-btn"
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
          >
            <div className="topnav-avatar">{userInitial}</div>
            <div className="topnav-user-info">
              <span className="topnav-user-name">{userName}</span>
              <span className="topnav-user-role">{roleLabel}</span>
            </div>
            <svg className={`topnav-chevron ${profileOpen ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="topnav-dropdown profile-dropdown">
              <div className="topnav-profile-card">
                <div className="topnav-avatar lg">{userInitial}</div>
                <div>
                  <div className="topnav-user-name">{userName}</div>
                  <div className="topnav-user-role">{roleLabel}</div>
                </div>
              </div>
              <div className="topnav-dropdown-divider" />
              <Link to="/profile" className="topnav-dropdown-item" onClick={() => setProfileOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                My Profile
              </Link>
              <Link to="/settings" className="topnav-dropdown-item" onClick={() => setProfileOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </Link>
              <div className="topnav-dropdown-divider" />
              <button className="topnav-dropdown-item logout" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
