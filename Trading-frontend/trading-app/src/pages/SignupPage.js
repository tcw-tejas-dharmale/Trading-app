import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import './LoginPage.css'; // Reuse Login styles

const SignupPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup, login } = useAuth(); // Assuming signup function exists in context, otherwise we need to implement it
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
            const token = localStorage.getItem('token');
            if (!token && login) {
                const loggedIn = await login(email, password);
                if (!loggedIn) {
                    setError('Account created, but login failed. Please sign in.');
                    return;
                }
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
                    <h1 className="login-title login-title-center">Create account</h1>
                    <p className="login-subtitle">Set up your profile in seconds.</p>

                    {error && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
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
                                    autoComplete="off"
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
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="Password"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Confirm Password"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
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
