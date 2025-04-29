// src/pages/SignUp.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignUp.css';

function SignUp() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSignUp = async () => {
        if (username && email && password) {
            const user = { username, email, password };

            try {
                const res = await fetch('http://localhost:4000/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(user),
                });
                const data = await res.json();
                console.log(data.message);
                navigate('/signin');
            } catch (err) {
                console.error('Error signing up:', err);
                alert('Error signing up. Please try again.');
            }
        } else {
            alert('Please fill in all fields.');
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-card">
                <div className="signup-header">
                    <h2>Sign Up</h2>
                    <p>Join the AI Platform today</p>
                </div>
                <form className="signup-form" onSubmit={(e) => { e.preventDefault(); handleSignUp(); }}>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        <span className="input-icon">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </span>
                    </div>
                    <div className="input-group">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <span className="input-icon">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </span>
                    </div>
                    <div className="input-group">
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <span className="input-icon">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                <path d="M12 2a5 5 0 0 0-5 5v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v2H9V7a3 3 0 0 1 3-3z"></path>
                            </svg>
                        </span>
                    </div>
                    <button type="submit" className="signup-btn">Sign Up</button>
                </form>
                <div className="signup-footer">
                    <p>
                        Already have an account?{' '}
                        <span className="signin-link" onClick={() => navigate('/signin')}>
                            Sign In
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default SignUp;