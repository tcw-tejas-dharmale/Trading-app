import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const OAuthCallbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('oauth_error');
    const token = params.get('token');

    if (oauthError) {
      setError('Google sign-in failed. Please try again.');
      return;
    }

    if (!token) {
      setError('Missing login token. Please try again.');
      return;
    }

    const run = async () => {
      try {
        await completeOAuthLogin(token);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setError('Unable to complete sign-in. Please try again.');
      }
    };

    run();
  }, [location.search, completeOAuthLogin, navigate]);

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card login-card-compact">
          <h1 className="login-title">Signing you in…</h1>
          <p className="login-subtitle">Completing Google authentication.</p>

          {error && (
            <>
              <div className="error-message">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
              <div className="login-footer">
                <p className="login-footer-text">
                  <Link to="/login" className="login-footer-link">
                    Back to login
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;

