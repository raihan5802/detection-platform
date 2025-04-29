// src/components/HomeTopBar.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomeTopBar.css';

function HomeTopBar({
    activeSection,
    changeSection,
    isAuthenticated,
    toggleHeroText
}) {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isIconToggled, setIsIconToggled] = useState(false);
    const dropdownRef = useRef(null);
    const lastScrollY = useRef(0);
    const scrollDirection = useRef('none');

    // This is crucial - we'll use this to prevent the component from handling
    // scroll events that would normally move to other sections
    const isHeroSection = activeSection === 'hero';

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) {
            setUser(storedUser);
        }

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        // Handle wheel events to detect scroll direction without actually scrolling
        const handleWheel = (e) => {
            // Only handle wheel events when in the hero section
            if (isHeroSection) {
                e.preventDefault();

                // Determine scroll direction
                if (e.deltaY > 0 && !isIconToggled) {
                    // Scrolling down - toggle hamburger icon to cross, hide hero text
                    setIsIconToggled(true);
                    if (toggleHeroText) toggleHeroText(false);
                } else if (e.deltaY < 0 && isIconToggled) {
                    // Scrolling up - toggle hamburger icon back to hamburger, show hero text
                    setIsIconToggled(false);
                    if (toggleHeroText) toggleHeroText(true);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        // Only add the wheel event listener if we're in the hero section
        if (isHeroSection) {
            window.addEventListener('wheel', handleWheel, { passive: false });
        }

        // Cleanup function
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (isHeroSection) {
                window.removeEventListener('wheel', handleWheel);
            }
        };
    }, [isHeroSection, isIconToggled, toggleHeroText]);

    const handleSignOut = () => {
        localStorage.removeItem('user');
        setUser(null);
        setIsDropdownOpen(false);
        navigate('/');
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    // Add this function to toggle the icon state when clicked
    const handleIconToggle = () => {
        const newToggleState = !isIconToggled;
        setIsIconToggled(newToggleState);

        // Toggle hero text visibility (inverse of icon toggle state)
        // When icon is toggled to cross, hero text should be hidden
        if (toggleHeroText) {
            toggleHeroText(!newToggleState);
        }
    };

    // Handle clicking on a section in the navigation
    const handleSectionClick = (sectionId, event) => {
        event.preventDefault();

        // Reset icon and text state when navigating away from hero
        if (activeSection === 'hero' && sectionId !== 'hero') {
            setIsIconToggled(false);
            if (toggleHeroText) toggleHeroText(true);
        }

        changeSection(sectionId);
    };

    return (
        <>
            <header id="masthead" className={`site-header ${isScrolled ? 'sticky' : 'transparent-header'}`}>
                <div className="container-fluid d-flex align-items-center justify-content-between">
                    <div className="site-branding">
                        <a href="#" onClick={(e) => {
                            e.preventDefault();
                            setIsIconToggled(false);
                            if (toggleHeroText) toggleHeroText(true);
                            changeSection('hero');
                        }}>
                            <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2" fill="none">
                                <path d="M4 12 L8 4 L16 20 L20 12" />
                                <circle cx="12" cy="12" r="2" />
                                <path d="M12 10 V4 M12 14 V20" />
                            </svg>
                            <span>Annotra</span>
                        </a>
                    </div>

                    {/* Main Navigation Links */}
                    <nav className="main-nav">
                        <ul className="nav-list">
                            <li className={`nav-item ${activeSection === 'hero' ? 'active' : ''}`}>
                                <a href="#hero" onClick={(e) => handleSectionClick('hero', e)}>Home</a>
                            </li>
                            <li className={`nav-item ${activeSection === 'services' ? 'active' : ''}`}>
                                <a href="#services" onClick={(e) => handleSectionClick('services', e)}>Services</a>
                            </li>
                            <li className={`nav-item ${activeSection === 'features' ? 'active' : ''}`}>
                                <a href="#features" onClick={(e) => handleSectionClick('features', e)}>Features</a>
                            </li>
                            <li className={`nav-item ${activeSection === 'footer' ? 'active' : ''}`}>
                                <a href="#footer" onClick={(e) => handleSectionClick('footer', e)}>Contact</a>
                            </li>
                        </ul>
                    </nav>

                    <div className="header-right-group">

                        <div className="demobutton-top">
                            <a href="/signin" onClick={(e) => { e.preventDefault(); navigate('/signin'); }}>
                                {user ? 'Dashboard' : 'Sign In'}
                            </a>
                        </div>

                        {/* Visual toggle between hamburger and cross */}
                        <div className={`hamburger hamburger--spin ${isIconToggled ? 'is-active' : ''}`}
                            onClick={handleIconToggle}
                        >
                            <span className="hamburger-box">
                                <span className="hamburger-inner"></span>
                            </span>
                        </div>

                    </div>


                </div>
            </header>

            {/* User Dropdown */}
            {isDropdownOpen && user && (
                <div className="user-dropdown" ref={dropdownRef}>
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
        </>
    );
}

export default HomeTopBar;