// src/pages/UserHome.js
import React from 'react';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './UserHome.css';

export default function UserHome() {
    return (
        <div className="userhome-container">
            <UserHomeTopBar />
            <main className="userhome-content">
                {/* Your UserHome content goes here */}
            </main>
        </div>
    );
}
