// src/components/FeaturesSection.js
import React from 'react';

function FeaturesSection() {
    const features = [
        {
            title: 'AI-Assisted Labeling',
            description: 'Smart pre-annotations and auto-labeling to speed up workflows by up to 80%. Our AI models continuously learn from your annotations to become even more accurate over time.',
            icon: (
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
            ),
            color: '#3498db'
        },
        {
            title: 'Real-time Collaboration',
            description: 'Work simultaneously with your team on the same project. Track changes, assign tasks, and communicate within the platform to ensure efficient team coordination.',
            icon: (
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            ),
            color: '#2ecc71'
        },
        {
            title: 'Quality Assurance',
            description: 'Built-in review workflows and consensus mechanisms ensure high-quality annotations. Set up multi-stage approval processes and track quality metrics to maintain dataset excellence.',
            icon: (
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            ),
            color: '#9b59b6'
        },
        {
            title: 'Model Integration',
            description: 'Seamlessly connect with your ML pipelines and frameworks. Import and export data in multiple formats compatible with TensorFlow, PyTorch, and other major ML libraries.',
            icon: (
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
            ),
            color: '#e74c3c'
        }
    ];

    return (
        <div className="features-section">
            <div className="section-header">
                <h2>Why Choose Our Platform</h2>
                <p>Industry-leading features to accelerate your AI development</p>
            </div>

            <div className="features-grid">
                {features.map((feature, index) => (
                    <div className="feature-card" key={index}>
                        <div className="feature-icon" style={{ color: feature.color }}>
                            {feature.icon}
                        </div>
                        <h3 style={{ color: feature.color }}>{feature.title}</h3>
                        <p>{feature.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default FeaturesSection;