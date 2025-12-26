import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchInstruments } from '../services/api';
import './Navbar.css';

const Navbar = ({ onInstrumentChange, selectedInstrument }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [instruments, setInstruments] = useState([]);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userInitial = (user?.name || user?.email || '').trim().charAt(0).toUpperCase();

    useEffect(() => {
        if (location.pathname === '/dashboard') {
            loadInstruments();
        }
    }, [location.pathname]);

    const loadInstruments = async () => {
        try {
            const data = await fetchInstruments();
            if (data && data.length > 0) {
                setInstruments(data);
            } else {
                throw new Error("No instruments found");
            }
        } catch (error) {
            console.error("Failed to load instruments", error);
            setInstruments([]);
        }
    };

    // Set default instrument when on dashboard and none selected
    useEffect(() => {
        if (location.pathname === '/dashboard' && instruments.length > 0 && !selectedInstrument) {
            onInstrumentChange(instruments[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, instruments]);

    useEffect(() => {
        setIsUserMenuOpen(false);
    }, [location.pathname]);

    const handleInstrumentSelect = (event) => {
        const value = event.target.value;
        if (!value) return;
        const inst = instruments.find(i => i.instrument_token === parseInt(value));
        if (inst) onInstrumentChange(inst);
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
                            <img
                                src={`${process.env.PUBLIC_URL}/images/logo.png`}
                                alt="WyseTrade logo"
                            />
                        </span>
                        <span className="brand-name">WyseTrade</span>
                    </Link>
                </div>

                <div className="navbar-actions">
                    {location.pathname.startsWith('/dashboard') && (
                        <div className="instrument-dropdown">
                            <select
                                className="input instrument-select"
                                onFocus={loadInstruments}
                                value={selectedInstrument?.instrument_token || ''}
                                onChange={handleInstrumentSelect}
                            >
                                <option value="">Get Instruments</option>
                                {instruments.map(inst => (
                                    <option key={inst.instrument_token} value={inst.instrument_token}>
                                        {inst.name} ({inst.tradingsymbol})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="user-menu-wrapper">
                        {!user ? (
                            <Link to="/dashboard" className="btn btn-outline navbar-login">
                                Login
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className="navbar-icon-button navbar-avatar"
                                aria-label="Profile"
                                onClick={() => setIsUserMenuOpen((open) => !open)}
                            >
                                {userInitial || '?'}
                            </button>
                        )}
                        {user && isUserMenuOpen && (
                            <div className="user-menu">
                                <Link to="/profile" className="user-menu-item">
                                    Profile
                                </Link>
                                <button
                                    type="button"
                                    className="user-menu-item"
                                    onClick={() => {
                                        setIsUserMenuOpen(false);
                                        logout();
                                    }}
                                >
                                    Log out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
