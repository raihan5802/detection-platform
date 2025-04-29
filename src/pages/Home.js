// src/pages/Home.js
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeTopBar from '../components/HomePage/HomeTopBar';
import HeroSection from '../components/HomePage/HeroSection';
import ServicesSection from '../components/HomePage/ServicesSection';
import FeaturesSection from '../components/HomePage/FeaturesSection';
import FooterSection from '../components/HomePage/FooterSection';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [isHeroTextVisible, setIsHeroTextVisible] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);

  // Create refs for each section to enable scrolling to them only when explicitly requested
  const heroRef = useRef(null);
  const servicesRef = useRef(null);
  const featuresRef = useRef(null);
  const footerRef = useRef(null);

  // Section refs array for easier access
  const sectionRefs = {
    'hero': heroRef,
    'services': servicesRef,
    'features': featuresRef,
    'footer': footerRef
  };

  // Section order for navigation
  const sectionOrder = ['hero', 'services', 'features', 'footer'];

  useEffect(() => {
    const userSession = localStorage.getItem('user');
    setIsAuthenticated(!!userSession);

    // Improved scroll handling with debounce
    let scrollTimeout;

    const handleWheel = (e) => {
      // If in hero section, let HomeTopBar handle the wheel event for icon toggle
      if (activeSection === 'hero') {
        return;
      }

      // For other sections, handle section navigation as before
      // Prevent default scrolling behavior
      e.preventDefault();

      // Return if already scrolling
      if (isScrolling) return false;

      // Clear any existing timeout
      clearTimeout(scrollTimeout);

      // Set scrolling state to true
      setIsScrolling(true);

      // Determine scroll direction
      const direction = e.deltaY > 0 ? 'down' : 'up';

      // Get current section index
      const currentIndex = sectionOrder.indexOf(activeSection);

      // Calculate next section index based on direction
      let nextIndex;
      if (direction === 'down') {
        nextIndex = Math.min(currentIndex + 1, sectionOrder.length - 1);
      } else {
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      // Get next section id
      const nextSection = sectionOrder[nextIndex];

      // Only change section if it's different
      if (nextSection !== activeSection) {
        changeSection(nextSection);
      }

      // Reset scrolling state after animation completes
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 800); // Animation duration plus buffer

      return false;
    };

    // Add event listener to handle wheel events
    window.addEventListener('wheel', handleWheel, { passive: false });

    // Make only the active section visible and hide others
    showActiveSection(activeSection);

    // Add keyboard navigation
    const handleKeyDown = (e) => {
      if (isScrolling) return;

      const currentIndex = sectionOrder.indexOf(activeSection);
      let nextIndex;

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        nextIndex = Math.min(currentIndex + 1, sectionOrder.length - 1);
        const nextSection = sectionOrder[nextIndex];
        if (nextSection !== activeSection) {
          setIsScrolling(true);
          changeSection(nextSection);
          setTimeout(() => setIsScrolling(false), 800);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        nextIndex = Math.max(currentIndex - 1, 0);
        const nextSection = sectionOrder[nextIndex];
        if (nextSection !== activeSection) {
          setIsScrolling(true);
          changeSection(nextSection);
          setTimeout(() => setIsScrolling(false), 800);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(scrollTimeout);
    };
  }, [activeSection, isScrolling]);

  // Function to handle changing active section
  const changeSection = (sectionId) => {
    // First set the active section state
    setActiveSection(sectionId);

    // Then show only that section
    showActiveSection(sectionId);

    // Reset hero text visibility based on section
    setIsHeroTextVisible(sectionId === 'hero');

    // Add smooth scrolling animation class
    document.body.classList.add('smooth-scroll');

    // Remove class after animation completes
    setTimeout(() => {
      document.body.classList.remove('smooth-scroll');
    }, 800);
  };

  // Function to show only the active section with smooth transitions
  const showActiveSection = (sectionId) => {
    // Hide all sections with fade out effect
    document.querySelectorAll('.section-container').forEach(section => {
      section.style.display = 'none';
      section.classList.remove('section-active');
    });

    // Show only the active section with fade in effect
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
      activeSection.style.display = 'block';

      // Force a reflow to ensure the display change has taken effect
      void activeSection.offsetWidth;

      // Add active class for animation
      setTimeout(() => {
        activeSection.classList.add('section-active');
      }, 50);
    }
  };

  // Function to toggle hero text visibility
  const toggleHeroText = (isVisible) => {
    setIsHeroTextVisible(isVisible);
  };

  // Handle navigation based on authentication
  const handleNavigation = (path, state) => {
    if (!isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', JSON.stringify({
        path,
        state
      }));
      navigate('/signin');
    } else {
      navigate(path, { state });
    }
  };

  return (
    <div className="home-container">
      <HomeTopBar
        activeSection={activeSection}
        changeSection={changeSection}
        isAuthenticated={isAuthenticated}
        toggleHeroText={toggleHeroText}
      />

      <div id="hero" className="section-container" ref={heroRef}>
        <HeroSection
          isHeroTextVisible={isHeroTextVisible}
          changeSection={changeSection}
          navigate={navigate}
        />
      </div>

      <div id="services" className="section-container" ref={servicesRef}>
        <ServicesSection
          handleNavigation={handleNavigation}
          isAuthenticated={isAuthenticated}
        />
      </div>

      <div id="features" className="section-container" ref={featuresRef}>
        <FeaturesSection />
      </div>

      <div id="footer" className="section-container" ref={footerRef}>
        <FooterSection
          handleNavigation={handleNavigation}
        />
      </div>
    </div>
  );
}

export default Home;