import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchInstruments } from '../services/api';
import { LogOut, User, BarChart2 } from 'lucide-react';
import './Navbar.css';

const Navbar = ({ onInstrumentChange, selectedInstrument }) => {
    const { user, login, logout } = useAuth();
    const [instruments, setInstruments] = useState([]);
    const [showLogin, setShowLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (user) {
            loadInstruments();
        }
    }, [user]);

    const loadInstruments = async () => {
        try {
            const data = await fetchInstruments();
            setInstruments(data);
            if (data.length > 0 && !selectedInstrument) {
                onInstrumentChange(data[0]);
            }
        } catch (error) {
            console.error("Failed to load instruments", error);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const success = await login(email, password);
        if (success) setShowLogin(false);
        else alert("Login failed");
    };

    return (
        <nav className="navbar">
            <div className="navbar-content container">
                <div className="flex items-center gap-4">
                    <div className="logo flex items-center gap-2">
                        <BarChart2 color="var(--accent)" />
                        <span className="font-bold text-lg">TradePro</span>
                    </div>

                    {user && (
                        <div className="instrument-selector">
                            <select
                                className="input"
                                value={selectedInstrument?.instrument_token || ''}
                                onChange={(e) => {
                                    const inst = instruments.find(i => i.instrument_token === parseInt(e.target.value));
                                    onInstrumentChange(inst);
                                }}
                            >
                                {instruments.map(inst => (
                                    <option key={inst.instrument_token} value={inst.instrument_token}>
                                        {inst.name} ({inst.tradingsymbol})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="navbar-actions">
                    {user ? (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-secondary">
                                <User size={16} />
                                <span>Logged In</span>
                            </div>
                            <button onClick={logout} className="btn btn-outline text-sm flex items-center gap-2">
                                <LogOut size={16} />
                                Logout
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setShowLogin(!showLogin)} className="btn btn-primary">
                            Login
                        </button>
                    )}
                </div>
            </div>

            {showLogin && !user && (
                <div className="login-modal-overlay">
                    <div className="login-modal card">
                        <h2 className="text-lg font-bold mb-4">Login to TradePro</h2>
                        <form onSubmit={handleLogin} className="flex flex-column gap-4">
                            <input
                                type="email"
                                placeholder="Email"
                                className="input w-full"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                className="input w-full"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary w-full">Sign In</button>
                            <button type="button" onClick={() => setShowLogin(false)} className="btn text-sm w-full">Cancel</button>
                        </form>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
