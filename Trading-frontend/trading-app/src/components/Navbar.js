import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchInstruments } from '../services/api';
import { User } from 'lucide-react';
import './Navbar.css';

const Navbar = ({ onInstrumentChange, selectedInstrument }) => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [instruments, setInstruments] = useState([]);

    useEffect(() => {
        loadInstruments();
    }, []);

    const loadInstruments = async () => {
        try {
            const data = await fetchInstruments();
            setInstruments(data);
        } catch (error) {
            console.error("Failed to load instruments", error);
        }
    };

    // Set default instrument when on dashboard and none selected
    useEffect(() => {
        if (location.pathname === '/dashboard' && instruments.length > 0 && !selectedInstrument) {
            onInstrumentChange(instruments[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, instruments]);

    const handleGetInstruments = async () => {
        await loadInstruments();
        if (location.pathname !== '/dashboard') {
            navigate('/dashboard');
        }
    };

    return (
        <nav className="navbar">
            <div className="navbar-content container">
                <div className="navbar-left">
                    <Link to="/" className="brand-logo">
                        <span className="brand-mark" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M4 16l5-5 4 4 7-8" />
                                <path d="M4 20h16" opacity="0.6" />
                            </svg>
                        </span>
                        <span className="brand-name">WysTrade</span>
                    </Link>
                </div>

                <div className="navbar-actions">
                    <Link
                        to={user ? '/profile' : '/login'}
                        className="navbar-icon-button"
                        aria-label={user ? 'Profile' : 'Sign In'}
                    >
                        <User size={18} />
                    </Link>
                    <button
                        type="button"
                        className="btn btn-primary get-instruments-btn"
                        onClick={handleGetInstruments}
                    >
                        Get Instruments
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
