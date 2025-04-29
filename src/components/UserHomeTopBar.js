import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import './UserHomeTopBar.css';

function UserHomeTopBar({
    taskName,
    onPrev,
    onNext,
    onSave,
    onZoomIn,
    onZoomOut,
    onExport,
    currentIndex,
    total,
    showControls = false,
    isSaving = false
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const dropdownRef = useRef(null);
    const mobileMenuRef = useRef(null);

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const notificationsRef = useRef(null);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) {
            setUser(storedUser);
        }

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
                setIsMobileMenuOpen(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
                setIsNotificationsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const storedUser = JSON.parse(localStorage.getItem('user'));
                if (!storedUser) return;

                const res = await fetch(`http://localhost:4000/api/notifications/${storedUser.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setNotifications(data);
                    setUnreadCount(data.filter(n => !n.is_read).length);
                }
            } catch (error) {
                console.error('Error fetching notifications:', error);
            }
        };

        fetchNotifications();

        // Set up polling for notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleSignOut = () => {
        localStorage.removeItem('user');
        setUser(null);
        setIsDropdownOpen(false);
        navigate('/');
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
        if (isNotificationsOpen) {
            setIsNotificationsOpen(false);
        }
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    // Mark notification as read
    const handleNotificationClick = async (notification) => {
        try {
            if (!notification.is_read) {
                await fetch(`http://localhost:4000/api/notifications/${notification.notification_id}`, {
                    method: 'PUT'
                });

                // Update state to mark notification as read
                setNotifications(notifications.map(n =>
                    n.notification_id === notification.notification_id
                        ? { ...n, is_read: true }
                        : n
                ));
                setUnreadCount(unreadCount - 1);
            }

            // Navigate to related project if available
            if (notification.related_project_id) {
                navigate(`/project-info/${notification.related_project_id}`);
                setIsNotificationsOpen(false);
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Toggle notifications panel
    const toggleNotifications = () => {
        setIsNotificationsOpen(!isNotificationsOpen);
        if (isDropdownOpen) {
            setIsDropdownOpen(false);
        }
    };

    // Format notification date
    const formatNotificationDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 60) {
            return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    // Regular menu items for home/images pages
    const regularMenu = (
        <>
            <div className="menu-item">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M2 9.88L5.12 13 8.88 7 12 13l3.88-5.88L19.12 13 22 9.88"></path>
                    <rect x="3" y="13" width="18" height="8" rx="2"></rect>
                </svg>
                <span onClick={() => navigate('/projects')}>Projects</span>
            </div>
            <div className="menu-item">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span onClick={() => navigate('/tasks')}>Tasks</span>
            </div>
        </>
    );

    // Task name for annotation pages
    const annotationMenu = (
        <div className="annotation-menu">
            {taskName && (
                <div className="task-name">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path>
                        <polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon>
                    </svg>
                    <span>{taskName}</span>
                </div>
            )}
        </div>
    );

    return (
        <header className="user-home-topbar">
            <div className="topbar-container">
                {/* Logo Section */}
                <div className="topbar-logo" onClick={() => navigate('/userhome')}>
                    <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M4 12 L8 4 L16 20 L20 12" />
                        <circle cx="12" cy="12" r="2" />
                        <path d="M12 10 V4 M12 14 V20" />
                    </svg>
                    <span>Annotra</span>
                </div>

                {/* Mobile Menu Toggle */}
                <div className="topbar-menu-toggle" onClick={toggleMobileMenu}>
                    <div className={`menu-toggle-bar ${isMobileMenuOpen ? 'open' : ''}`}></div>
                </div>

                {/* Navigation Menu - Centered */}
                <nav className={`topbar-menu ${isMobileMenuOpen ? 'open' : ''}`} ref={mobileMenuRef}>
                    {showControls ? annotationMenu : regularMenu}
                </nav>

                {/* User Actions */}
                <div className="topbar-actions">
                    {user && (
                        <div className="notification-bell" ref={notificationsRef}>
                            <button className="notification-button" onClick={toggleNotifications} aria-label="Notifications">
                                <FiBell size={20} />
                                {unreadCount > 0 && (
                                    <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            {isNotificationsOpen && (
                                <div className="notifications-panel">
                                    <div className="notifications-header">
                                        <h3>Notifications</h3>
                                        {unreadCount > 0 && (
                                            <span className="unread-count">{unreadCount} unread</span>
                                        )}
                                    </div>

                                    <div className="notifications-list">
                                        {notifications.length > 0 ? (
                                            notifications.map(notification => (
                                                <div
                                                    key={notification.notification_id}
                                                    className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                                                    onClick={() => handleNotificationClick(notification)}
                                                >
                                                    <div className="notification-content">
                                                        <p className="notification-message">{notification.message}</p>
                                                        <span className="notification-time">
                                                            {formatNotificationDate(notification.created_at)}
                                                        </span>
                                                    </div>
                                                    {!notification.is_read && (
                                                        <div className="unread-marker"></div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="no-notifications">
                                                <p>No notifications yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {user ? (
                        <div className="user-profile" ref={dropdownRef}>
                            <div className="user-avatar" onClick={toggleDropdown}>
                                <span>{user.username.charAt(0).toUpperCase()}</span>
                            </div>

                            {isDropdownOpen && (
                                <div className="user-dropdown">
                                    <div className="dropdown-header">
                                        <span className="user-name">{user.username}</span>
                                        <span className="user-email">{user.email || 'user@example.com'}</span>
                                    </div>
                                    <div className="dropdown-divider"></div>
                                    <div className="dropdown-item" onClick={() => navigate('/account')}>
                                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        <span>Account</span>
                                    </div>
                                    <div className="dropdown-item" onClick={() => navigate('/tasks')}>
                                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <polyline points="10 9 9 9 8 9"></polyline>
                                        </svg>
                                        <span>Tasks</span>
                                    </div>
                                    <div className="dropdown-item" onClick={handleSignOut}>
                                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                            <polyline points="16 17 21 12 16 7"></polyline>
                                            <line x1="21" y1="12" x2="9" y2="12"></line>
                                        </svg>
                                        <span>Logout</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button className="signin-btn" onClick={() => navigate('/signin')}>
                            Sign In
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

export default UserHomeTopBar;
