import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getGoogleLoginUrl } from '../services/api';
import './LoginPage.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const oauthNext = useMemo(() => `${window.location.origin}/oauth/callback`, []);
  const loading = loadingEmail || loadingGoogle;

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('oauth_error');
    if (oauthError) {
      setError('Google sign-in failed. Please try again.');
    }
  }, [location.search]);

  useEffect(() => {
    if (!error) return;
    const timeoutId = window.setTimeout(() => setError(''), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoadingEmail(true);

    // Basic validation
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoadingEmail(false);
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      setLoadingEmail(false);
      return;
    }

    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again later.');
      console.error('Login error:', err);
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoadingGoogle(true);
    try {
      const { url } = await getGoogleLoginUrl(oauthNext);
      if (!url) {
        throw new Error('Missing OAuth URL');
      }
      window.location.assign(url);
    } catch (err) {
      console.error('Google login start error:', err);
      setError('Unable to start Google sign-in. Please try again.');
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card login-card-compact">
          <div className="login-brand">
            <span className="brand-mark" aria-hidden="true">
              <img
                src={`${process.env.PUBLIC_URL}/images/logo.png`}
                alt="WyseTrade logo"
              />
            </span>
            <span className="brand-name">WyseTrade</span>
          </div>
          <h1 className="login-title">Sign in</h1>
          <p className="login-subtitle">Access real-time signals and market tools.</p>

          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  name="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  name="password"
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

            <div className="auth-actions">
              <button
                type="button"
                className="btn btn-outline auth-button google-button"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <img
                  className="google-logo"
                  src={`${process.env.PUBLIC_URL}/images/google.png`}
                  alt="Google"
                />
                {loadingGoogle ? 'Signing in...' : 'Sign in'}
              </button>

              <button
                type="submit"
                className="btn btn-primary auth-button"
                disabled={loading}
              >
                {loadingEmail ? 'Signing in...' : 'Sign In'}
              </button>
            </div>

          
          </form>

          <div className="login-footer">
            <div className="login-footer-actions">
              <p className="login-footer-text">
                New here?{' '}
                <Link to="/signup" className="login-footer-link">
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
