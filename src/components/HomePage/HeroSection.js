// src/components/HeroSection.js
import React, { useEffect, useState } from 'react';

function HeroSection({ isHeroTextVisible = true, changeSection, navigate }) {
    // Use state to control animation classes
    const [textClasses, setTextClasses] = useState('');

    // Update animation classes when visibility changes
    useEffect(() => {
        if (isHeroTextVisible) {
            setTextClasses('fade-in');
        } else {
            setTextClasses('fade-out');
        }
    }, [isHeroTextVisible]);

    useEffect(() => {
        // Initialize GSAP animations for parallax effect if GSAP is available
        if (typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined') {
            const gsap = window.gsap;
            const ScrollTrigger = window.ScrollTrigger;

            gsap.registerPlugin(ScrollTrigger);

            // Parallax scrolling for layers
            gsap.to("#layer-1", {
                y: 100,
                scrollTrigger: {
                    trigger: "#hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });

            gsap.to("#layer-2", {
                y: 200,
                scrollTrigger: {
                    trigger: "#hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });

            gsap.to("#layer-3", {
                y: 300,
                scrollTrigger: {
                    trigger: "#hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });

            gsap.to("#layer-4", {
                y: 400,
                scrollTrigger: {
                    trigger: "#hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });
        }
    }, []);

    // Handler for navigation links in columns
    const handleSectionNavigation = (e, section) => {
        e.preventDefault();
        if (changeSection) {
            changeSection(section);
        }
    };

    return (
        <section className="hero-section">
            {/* Main hero text */}
            <div className={`hero-text-container ${textClasses}`} style={{
                opacity: isHeroTextVisible ? 1 : 0,
                transition: 'opacity 0.5s ease-in-out',
                visibility: isHeroTextVisible ? 'visible' : 'hidden'
            }}>
                <h1 className="main-intro-text">Next-Gen AI Annotation Platform</h1>
                <h2 className="home_intro_sub_text">Streamline your machine learning workflows</h2>

                {/* CTA Buttons */}
                <div className="hero-cta-buttons">
                    <button className="cta-button primary" onClick={() => navigate('/signin')}>
                        Start Free Trial
                    </button>
                    <button className="cta-button secondary" onClick={() => window.scrollTo(0, 0)}>
                        Learn More
                    </button>
                </div>
            </div>

            {/* Column layout that appears when hamburger becomes cross */}
            <div className="hero-columns-container" style={{
                opacity: isHeroTextVisible ? 0 : 1,
                visibility: isHeroTextVisible ? 'hidden' : 'visible',
                transition: 'opacity 0.5s ease-in-out, visibility 0.5s ease-in-out'
            }}>
                {/* Column 1: Products */}
                <div className="hero-column">
                    <div className="column-content">
                        <h3>Products</h3>
                        <div className="column-menu">
                            <div className="menu-item">
                                <a href="#" onClick={(e) => handleSectionNavigation(e, 'services')}>Image Detection</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Pricing */}
                <div className="hero-column">
                    <div className="column-content">
                        <h3>Pricing</h3>
                        <div className="column-menu">
                            <div className="menu-item">
                                <a href="#" onClick={(e) => handleSectionNavigation(e, 'features')}>Features</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 3: Resources */}
                <div className="hero-column">
                    <div className="column-content">
                        <h3>Resources</h3>
                        <div className="column-menu">
                            <div className="menu-item">
                                <a href="#" onClick={(e) => handleSectionNavigation(e, 'services')}>API</a>
                            </div>
                            <div className="menu-item">
                                <a href="#" onClick={(e) => handleSectionNavigation(e, 'services')}>Documentation</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 4: Company */}
                <div className="hero-column">
                    <div className="column-content">
                        <h3>Company</h3>
                        <div className="column-menu">
                            <div className="menu-item">
                                <a href="#" onClick={(e) => handleSectionNavigation(e, 'footer')}>About Us</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Background layers */}
            <div className="layer" id="layer-4"></div>
            <div className="layer" id="layer-3"></div>
            <div className="layer" id="layer-2"></div>
            <div className="layer" id="layer-1"></div>
        </section>
    );
}

export default HeroSection;