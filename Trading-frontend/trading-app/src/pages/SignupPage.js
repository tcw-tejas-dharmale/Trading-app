import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, AlertCircle } from 'lucide-react';
import './LoginPage.css'; // Reuse Login styles

const SignupPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth(); // Assuming signup function exists in context, otherwise we need to implement it
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            return setError('Passwords do not match');
        }

        try {
            setError('');
            setLoading(true);
            if (signup) {
                await signup(email, password, name);
            } else {
                // Fallback if signup not currently in context, though plan implies implementing it.
                // For now, let's mimic login or throw error.
                // We will need to update AuthContext to support signup.
                throw new Error("Signup function not implemented in context yet");
            }
            navigate('/dashboard');
        } catch (err) {
            setError('Failed to create an account');
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card login-card-compact">
                    <div className="login-brand">
                        <span className="brand-mark" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M4 16l5-5 4 4 7-8" />
                                <path d="M4 20h16" opacity="0.6" />
                            </svg>
                        </span>
                        <span className="brand-name">WysTrade</span>
                    </div>
                    <h1 className="login-title">Create account</h1>
                    <p className="login-subtitle">Set up your profile in seconds.</p>

                    {error && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <div className="input-wrapper">
                                <User size={18} className="input-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="Full Name"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    className="form-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="Email Address"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="Password"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Confirm Password"
                                />
                            </div>
                        </div>
                        <button disabled={loading} className="btn btn-primary btn-block" type="submit">
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                    </form>
                    <div className="login-footer">
                        <p className="login-footer-text">
                            Already have an account? <Link to="/login" className="login-footer-link">Log In</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
