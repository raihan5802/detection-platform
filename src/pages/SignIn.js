// src/pages/SignIn.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignIn.css';

function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSignIn = async () => {
        if (email && password) {
            try {
                const res = await fetch('http://localhost:4000/api/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    const redirectInfo = localStorage.getItem('redirectAfterLogin');
                    if (redirectInfo) {
                        const { path, state } = JSON.parse(redirectInfo);
                        localStorage.removeItem('redirectAfterLogin');
                        navigate(path, { state });
                    } else {
                        navigate('/userhome');
                    }
                } else {
                    alert('Invalid email or password');
                }
            } catch (err) {
                console.error('Error signing in:', err);
                alert('Error signing in. Please try again.');
            }
        } else {
            alert('Please enter a valid email and password.');
        }
    };

    return (
        <div className="signin-container">
            <div className="signin-card">
                <div className="signin-header">
                    <h2>Sign In</h2>
                    <p>Welcome back to AI Platform</p>
                </div>
                <form className="signin-form" onSubmit={(e) => { e.preventDefault(); handleSignIn(); }}>
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
                    <button type="submit" className="signin-btn">Sign In</button>
                </form>
                <div className="signin-footer">
                    <p>
                        Don't have an account?{' '}
                        <span className="signup-link" onClick={() => navigate('/signup')}>
                            Sign Up
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default SignIn;