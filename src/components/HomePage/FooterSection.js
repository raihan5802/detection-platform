// src/components/FooterSection.js
import React, { useState } from 'react';

function FooterSection({ handleNavigation }) {
    const [email, setEmail] = useState('');

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle newsletter subscription
        console.log('Newsletter subscription for:', email);
        // Reset email field
        setEmail('');
        // You would typically make an API call here
        alert('Thanks for subscribing to our newsletter!');
    };

    return (
        <footer className="home-footer">
            <div className="footer-main-content">
                <div className="footer-left">
                    <h2>Let's Create Together</h2>
                    <p>Whether you're looking to develop new AI annotation solutions or establish a long-term data pipeline, our team is ready to collaborate.</p>

                    <div className="footer-contact-info">
                        <div className="footer-info-item">
                            <div className="info-icon">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                            </div>
                            <div className="info-content">
                                <h4>Headquarters</h4>
                                <p>123 Tech Avenue, Innovation District, San Francisco, CA</p>
                            </div>
                        </div>

                        <div className="footer-info-item">
                            <div className="info-icon">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </div>
                            <div className="info-content">
                                <h4>Contact</h4>
                                <p>+1 (415) 555-0123</p>
                                <p>info@annotra.com</p>
                            </div>
                        </div>

                        <div className="footer-info-item">
                            <div className="info-icon">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </div>
                            <div className="info-content">
                                <h4>Business Hours</h4>
                                <p>Monday - Friday: 8:00 AM - 6:00 PM</p>
                                <p>Saturday - Sunday: Closed</p>
                            </div>
                        </div>
                    </div>

                    <div className="footer-social">
                        <h4>Follow Us</h4>
                        <div className="social-icons">
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                                    <rect x="2" y="9" width="4" height="12"></rect>
                                    <circle cx="4" cy="4" r="2"></circle>
                                </svg>
                            </a>
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                                </svg>
                            </a>
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                                </svg>
                            </a>
                            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer">
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
                                    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>

                <div className="footer-right">
                    <div className="footer-form-container">
                        <h2>Get in Touch</h2>
                        <form className="footer-contact-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="firstName">First Name</label>
                                    <input type="text" id="firstName" name="firstName" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="lastName">Last Name</label>
                                    <input type="text" id="lastName" name="lastName" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input type="email" id="email" name="email" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="company">Company Name</label>
                                <input type="text" id="company" name="company" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="inquiryType">Inquiry Type</label>
                                <input type="text" id="inquiryType" name="inquiryType" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="message">Message</label>
                                <textarea id="message" name="message" rows="4"></textarea>
                            </div>

                            <button type="submit" className="send-message-btn">Send Message</button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="footer-bottom-section">
                <div className="footer-bottom-content">
                    <div className="company-info">
                        <h3>Annotra</h3>
                        <p>Premium AI annotation platform with a commitment to quality and innovation.</p>
                    </div>

                    <div className="footer-links-section">
                        <div className="footer-links-column">
                            <h4>Quick Links</h4>
                            <ul>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/'); }}>Home</a></li>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/services'); }}>Products</a></li>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/features'); }}>Capabilities</a></li>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/sustainability'); }}>Sustainability</a></li>
                            </ul>
                        </div>

                        <div className="footer-links-column">
                            <h4>Resources</h4>
                            <ul>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/certifications'); }}>Quality Certifications</a></li>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/compliance'); }}>Compliance Documents</a></li>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/sustainability'); }}>Sustainability Reports</a></li>
                                <li><a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/careers'); }}>Careers</a></li>
                            </ul>
                        </div>

                        <div className="footer-links-column">
                            <h4>Newsletter</h4>
                            <p>Subscribe to our newsletter for the latest updates.</p>
                            <form className="newsletter-form" onSubmit={handleSubmit}>
                                <div className="newsletter-input-group">
                                    <input
                                        type="email"
                                        placeholder="Your email"
                                        value={email}
                                        onChange={handleEmailChange}
                                        required
                                    />
                                    <button type="submit">
                                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                            <line x1="22" y1="2" x2="11" y2="13"></line>
                                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                        </svg>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="footer-copyright">
                    <p>© 2025 Annotra AI Annotation Platform. All rights reserved.</p>
                    <div className="footer-legal-links">
                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/privacy'); }}>Privacy Policy</a>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/terms'); }}>Terms of Service</a>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('/sitemap'); }}>Sitemap</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default FooterSection;