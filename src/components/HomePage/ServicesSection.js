// src/components/ServicesSection.js
import React, { useState, useEffect } from 'react';

function ServicesSection({ handleNavigation, isAuthenticated }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight);

    const slides = [
        {
            title: 'Image Detection',
            description: 'Powerful tools for object detection including bounding box, polygon, polyline, point, and ellipse annotations. Perfect for training computer vision models for object recognition and localization.',
            image: 'https://images.unsplash.com/photo-1633412802994-5c058f151b66?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
            action: () => handleNavigation('/images', {
                segmentationMode: false,
                classificationMode: false
            }),
            color: '#3498db'
        },
        {
            title: 'Image Segmentation',
            description: 'Advanced segmentation tools supporting instance, semantic, and panoptic segmentation for detailed image analysis. Create pixel-perfect masks for the most demanding computer vision tasks.',
            image: 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
            action: () => handleNavigation('/images', {
                segmentationMode: true,
                classificationMode: false
            }),
            color: '#2ecc71'
        },
        {
            title: 'Image Classification',
            description: 'Streamlined tools to assign labels and categories to entire images for efficient dataset organization. Includes hierarchical classification and multi-label support for complex taxonomies.',
            image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
            action: () => handleNavigation('/images', {
                segmentationMode: false,
                classificationMode: true
            }),
            color: '#9b59b6'
        },
        {
            title: '3D Image Annotation',
            description: 'Cutting-edge tools for annotating 3D volumetric data and depth-enhanced imagery. Support for point clouds, mesh models, and multi-view reconstruction for autonomous vehicles and robotics.',
            image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
            action: () => handleNavigation('/images', {
                segmentationMode: false,
                classificationMode: false,
                threeDMode: true
            }),
            color: '#e74c3c'
        }
    ];

    // Update window height on resize
    useEffect(() => {
        const handleResize = () => {
            setWindowHeight(window.innerHeight);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const handlePrevSlide = () => {
        if (currentSlide > 0 && !isAnimating) {
            setIsAnimating(true);
            setCurrentSlide(currentSlide - 1);
            setTimeout(() => setIsAnimating(false), 500);
        }
    };

    const handleNextSlide = () => {
        if (currentSlide < slides.length - 1 && !isAnimating) {
            setIsAnimating(true);
            setCurrentSlide(currentSlide + 1);
            setTimeout(() => setIsAnimating(false), 500);
        }
    };

    // Calculate the adjusted height for the carousel container
    // This ensures it fits well within the viewport while leaving room for header and section title
    const calculateCarouselHeight = () => {
        // Subtract header (70px) and section title area (approx 150px) plus some margin from window height
        const availableHeight = windowHeight - 380;
        // Ensure minimum height for very small screens
        return Math.max(availableHeight, 400);
    };

    return (
        <div className="services-section">
            <div className="section-header">
                <h2>Annotation Services</h2>
                <p>Comprehensive tools for all your data labeling needs</p>
            </div>

            <div className="carousel-wrapper" style={{ height: 'auto' }}>
                <div className="carousel-indicators">
                    {slides.map((_, index) => (
                        <div
                            key={index}
                            className={`indicator ${currentSlide === index ? 'active' : ''}`}
                            onClick={() => {
                                if (!isAnimating) {
                                    setIsAnimating(true);
                                    setCurrentSlide(index);
                                    setTimeout(() => setIsAnimating(false), 500);
                                }
                            }}
                            style={{
                                backgroundColor: currentSlide === index ? slides[index].color : '',
                                width: currentSlide === index ? '50px' : '30px'
                            }}
                        />
                    ))}
                </div>

                <div
                    className="carousel-container"
                    style={{ height: `${calculateCarouselHeight()}px` }}
                >
                    <button
                        className="carousel-btn prev"
                        onClick={handlePrevSlide}
                        disabled={currentSlide === 0 || isAnimating}
                    >
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>

                    <div className="carousel-track">
                        {slides.map((slide, index) => (
                            <div
                                className={`carousel-card ${currentSlide === index ? 'active' : ''}`}
                                key={index}
                                style={{
                                    transform: `translateX(${(index - currentSlide) * 110}%)`,
                                    opacity: currentSlide === index ? 1 : 0.3,
                                    zIndex: currentSlide === index ? 10 : 1,
                                    transition: 'transform 0.5s ease, opacity 0.5s ease'
                                }}
                            >
                                <div className="card-content">
                                    <div className="card-text">
                                        <h3 style={{ color: slide.color }}>{slide.title}</h3>
                                        <p>{slide.description}</p>
                                        <button
                                            className="service-btn"
                                            onClick={slide.action}
                                            style={{
                                                backgroundColor: slide.color,
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                                            }}
                                        >
                                            Try {slide.title}
                                        </button>
                                    </div>
                                    <div className="card-image">
                                        <img src={slide.image} alt={slide.title} />
                                        <div className="image-overlay" style={{ backgroundColor: slide.color }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="carousel-btn next"
                        onClick={handleNextSlide}
                        disabled={currentSlide === slides.length - 1 || isAnimating}
                    >
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ServicesSection;