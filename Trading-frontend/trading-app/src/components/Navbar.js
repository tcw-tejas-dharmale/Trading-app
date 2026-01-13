import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchInstruments, fetchZerodhaLoginUrl, fetchQuote } from '../services/api';
import { subscribeMarketTicks, subscribeMarketStatus } from '../services/marketWs';
import './Navbar.css';

const INDEX_SYMBOLS = [
    { label: 'NIFTY 50', key: 'NIFTY 50' },
    { label: 'SENSEX', key: 'SENSEX' },
];

const Navbar = ({ onInstrumentChange, selectedInstrument }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isFetchingInstruments, setIsFetchingInstruments] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [indexQuotes, setIndexQuotes] = useState({});
    const [indexError, setIndexError] = useState('');
    const lastTickAtRef = React.useRef(0);
    const pollIntervalRef = React.useRef(null);
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
        if (!user) {
            setIndexQuotes({});
            setIndexError('');
            lastTickAtRef.current = 0;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        const indexSet = new Set(INDEX_SYMBOLS.map((item) => item.key));
        const pollQuotes = async () => {
            try {
                const symbols = INDEX_SYMBOLS.map((item) => item.key === 'SENSEX' ? 'BSE:SENSEX' : 'NSE:NIFTY 50').join(',');
                const data = await fetchQuote(symbols);
                const nextQuotes = {};
                INDEX_SYMBOLS.forEach((item) => {
                    const key = item.key === 'SENSEX' ? 'BSE:SENSEX' : 'NSE:NIFTY 50';
                    const quote = data?.[key];
                    if (quote) {
                        nextQuotes[item.key] = {
                            symbol: item.key,
                            ltp: quote.last_price,
                            close: quote?.ohlc?.close,
                            change_pct: null,
                        };
                    }
                });
                if (Object.keys(nextQuotes).length > 0) {
                    setIndexQuotes(nextQuotes);
                }
            } catch (error) {
                setIndexError('Unable to fetch live indices.');
            }
        };

        const ensurePolling = () => {
            if (pollIntervalRef.current) return;
            pollIntervalRef.current = setInterval(pollQuotes, 5000);
            pollQuotes();
        };

        const unsubscribeTicks = subscribeMarketTicks((ticks) => {
            lastTickAtRef.current = Date.now();
            setIndexError('');
            setIndexQuotes((prev) => {
                const next = { ...prev };
                ticks.forEach((tick) => {
                    if (indexSet.has(tick.symbol)) {
                        next[tick.symbol] = tick;
                    }
                });
                return next;
            });
        });
        const unsubscribeStatus = subscribeMarketStatus((payload) => {
            if (payload?.type === 'error') {
                setIndexError('Unable to stream indices. Falling back to polling.');
                ensurePolling();
            }
        });

        const watchdog = setInterval(() => {
            if (!lastTickAtRef.current || Date.now() - lastTickAtRef.current > 8000) {
                ensurePolling();
            }
        }, 4000);

        return () => {
            unsubscribeTicks();
            unsubscribeStatus();
            clearInterval(watchdog);
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [user]);

    const renderIndexQuote = (item) => {
        const tick = indexQuotes[item.key];
        if (!tick) {
            return (
                <div className="index-ticker">
                    <span className="index-label">{item.label}</span>
                    <span className="index-value">--</span>
                </div>
            );
        }
        const lastPrice = Number(tick.ltp);
        const close = Number(tick.close);
        const change = Number.isFinite(lastPrice) && Number.isFinite(close) ? lastPrice - close : null;
        const changePct = Number.isFinite(tick.change_pct) ? tick.change_pct : null;
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
