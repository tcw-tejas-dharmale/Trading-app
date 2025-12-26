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
    const [instrumentDetails, setInstrumentDetails] = useState(null);
    const [instrumentError, setInstrumentError] = useState('');
    const [isFetchingInstruments, setIsFetchingInstruments] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userInitial = (user?.name || user?.email || '').trim().charAt(0).toUpperCase();

    const loadInstruments = async () => {
        try {
            setIsFetchingInstruments(true);
            setInstrumentError('');
            const data = await fetchInstruments();
            if (Array.isArray(data) && data.length > 0) {
                setInstruments(data);
                const details = selectedInstrument || data[0];
                setInstrumentDetails(details);
                if (!selectedInstrument) {
                    onInstrumentChange(details);
                }
            } else {
                throw new Error("No instruments found");
            }
        } catch (error) {
            console.error("Failed to load instruments", error);
            setInstruments([]);
            setInstrumentDetails(null);
            setInstrumentError('Unable to load instruments. Please try again.');
        } finally {
            setIsFetchingInstruments(false);
        }
    };

    useEffect(() => {
        setIsUserMenuOpen(false);
    }, [location.pathname]);

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
                        <div className="instrument-fetch">
                            <button
                                type="button"
                                className="btn btn-primary instrument-button"
                                onClick={loadInstruments}
                                disabled={isFetchingInstruments}
                            >
                                {isFetchingInstruments ? 'Loading...' : 'Get Instrument'}
                            </button>
                            {instrumentError && (
                                <div className="instrument-message instrument-error" role="alert">
                                    {instrumentError}
                                </div>
                            )}
                            {!instrumentError && instrumentDetails && (
                                <div className="instrument-panel card">
                                    <div className="instrument-panel-header">
                                        <div>
                                            <div className="instrument-title">
                                                {instrumentDetails.name || 'Instrument Details'}
                                            </div>
                                            <div className="instrument-subtitle">
                                                Token {instrumentDetails.instrument_token ?? 'N/A'}
                                            </div>
                                        </div>
                                        <div className="instrument-count">
                                            Showing 1 of {instruments.length}
                                        </div>
                                    </div>
                                    <div className="instrument-grid">
                                        <div>
                                            <span>Trading Symbol</span>
                                            <strong>{instrumentDetails.tradingsymbol || 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <span>Exchange</span>
                                            <strong>{instrumentDetails.exchange || 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <span>Segment</span>
                                            <strong>{instrumentDetails.segment || 'N/A'}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}
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
