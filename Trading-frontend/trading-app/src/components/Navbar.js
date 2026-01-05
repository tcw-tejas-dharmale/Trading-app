import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchInstruments, fetchZerodhaLoginUrl, fetchQuote } from '../services/api';
import './Navbar.css';

const INDEX_SYMBOLS = [
    { label: 'NIFTY 50', key: 'NSE:NIFTY 50' },
    { label: 'SENSEX', key: 'BSE:SENSEX' },
];

const Navbar = ({ onInstrumentChange, selectedInstrument }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isFetchingInstruments, setIsFetchingInstruments] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [indexQuotes, setIndexQuotes] = useState({});
    const [indexError, setIndexError] = useState('');
    const userInitial = (user?.name || user?.email || '').trim().charAt(0).toUpperCase();

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => {
            setToast((current) => (current?.message === message ? null : current));
        }, 3500);
    };

    const loadInstruments = async () => {
        try {
            setIsFetchingInstruments(true);
            const data = await fetchInstruments();
            if (Array.isArray(data) && data.length > 0) {
                const details = selectedInstrument || data[0];
                if (!selectedInstrument) {
                    onInstrumentChange(details);
                }
                showToast('Instrument data loaded.', 'success');
            } else {
                throw new Error("No instruments found");
            }
        } catch (error) {
            console.error("Failed to load instruments", error);
            const status = error?.response?.status;
            if (status === 401 || status === 403 || status === 503) {
                try {
                    const response = await fetchZerodhaLoginUrl();
                    if (response?.login_url) {
                        window.open(response.login_url, '_blank', 'noopener,noreferrer');
                        showToast('Opening Zerodha login. Complete login to connect.', 'info');
                    } else {
                        showToast('Unable to start Zerodha login. Please try again.', 'error');
                    }
                } catch (loginError) {
                    console.error("Failed to load Zerodha login URL", loginError);
                    showToast('Unable to start Zerodha login. Please check API key.', 'error');
                }
            } else {
                showToast('Unable to load instruments. Please try again.', 'error');
            }
        } finally {
            setIsFetchingInstruments(false);
        }
    };

    useEffect(() => {
        setIsUserMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        let isActive = true;
        const fetchIndexQuotes = async () => {
            try {
                setIndexError('');
                const symbols = INDEX_SYMBOLS.map((item) => item.key).join(',');
                const data = await fetchQuote(symbols);
                if (!isActive) return;
                const nextQuotes = {};
                INDEX_SYMBOLS.forEach((item) => {
                    const quote = data?.[item.key];
                    if (quote) {
                        nextQuotes[item.key] = quote;
                    }
                });
                if (Object.keys(nextQuotes).length > 0) {
                    setIndexQuotes(nextQuotes);
                }
            } catch (error) {
                if (!isActive) return;
                const status = error?.response?.status;
                if (status === 401 || status === 403) {
                    setIndexError('Connect Zerodha to see indices.');
                }
            }
        };
        fetchIndexQuotes();
        const interval = setInterval(fetchIndexQuotes, 5000);
        return () => {
            isActive = false;
            clearInterval(interval);
        };
    }, []);

    const renderIndexQuote = (item) => {
        const quote = indexQuotes[item.key];
        if (!quote) {
            return (
                <div className="index-ticker">
                    <span className="index-label">{item.label}</span>
                    <span className="index-value">--</span>
                </div>
            );
        }
        const lastPrice = Number(quote.last_price);
        const close = Number(quote?.ohlc?.close);
        const change = Number.isFinite(quote.net_change)
            ? Number(quote.net_change)
            : (Number.isFinite(lastPrice) && Number.isFinite(close) ? lastPrice - close : null);
        const changePct = Number.isFinite(change) && Number.isFinite(close) && close !== 0
            ? (change / close) * 100
            : null;
        const direction = Number.isFinite(change) && change !== 0 ? (change > 0 ? 'up' : 'down') : 'flat';
        return (
            <div className={`index-ticker ${direction}`}>
                <span className="index-label">{item.label}</span>
                <span className="index-value">
                    {Number.isFinite(lastPrice) ? lastPrice.toFixed(2) : '--'}
                </span>
                <span className="index-change">
                    {Number.isFinite(change) ? `${change > 0 ? '+' : ''}${change.toFixed(2)}` : '--'}
                    {Number.isFinite(changePct) ? ` (${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%)` : ''}
                </span>
            </div>
        );
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
                    <div className="index-strip" aria-live="polite">
                        {INDEX_SYMBOLS.map((item) => (
                            <React.Fragment key={item.key}>
                                {renderIndexQuote(item)}
                            </React.Fragment>
                        ))}
                        {indexError && <span className="index-error">{indexError}</span>}
                    </div>
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
                        </div>
                    )}
                    {toast && (
                        <div className={`toast toast-${toast.type}`} role="status">
                            {toast.message}
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
