import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchInstruments } from '../services/api';
import { User } from 'lucide-react';
import './Navbar.css';

const Navbar = ({ onInstrumentChange, selectedInstrument }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [instruments, setInstruments] = useState([]);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M4 16l5-5 4 4 7-8" />
                                <path d="M4 20h16" opacity="0.6" />
                            </svg>
                        </span>
                        <span className="brand-name">WysTrade</span>
                    </Link>
                </div>

                <div className="navbar-actions">
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
                    <div className="user-menu-wrapper">
                        <Link
                            to={user ? '/profile' : '/login'}
                            className="navbar-icon-button"
                            aria-label={user ? 'Profile' : 'Sign In'}
                            onClick={(event) => {
                                if (!user) return;
                                event.preventDefault();
                                setIsUserMenuOpen((open) => !open);
                            }}
                        >
                            <User size={18} />
                        </Link>
                        {user && (
                            <button
                                type="button"
                                className="btn btn-outline navbar-logout"
                                onClick={logout}
                            >
                                Log out
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
