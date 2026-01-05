import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createZerodhaSession } from '../services/api';
import './ZerodhaCallback.css';

const ZerodhaCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Connecting with Zerodha');
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestToken = params.get('request_token');

    if (!requestToken) {
      setIsConnecting(false);
      setStatus('');
      setError('Missing request token. Please retry the Zerodha login.');
      return;
    }
    
    if (hasRequestedRef.current) {
      return;
    }
    hasRequestedRef.current = true;

    const connectSession = async () => {
      try {
        await createZerodhaSession(requestToken);
        localStorage.setItem('zerodha_connected', 'true');
        setStatus('Connected! Opening dashboard...');
        setIsConnecting(false);
        setTimeout(() => {
          navigate('/dashboard/nifty50');
        }, 800);
      } catch (err) {
        console.error('Failed to connect Zerodha session', err);
        setIsConnecting(false);
        setStatus('');
        setError('Unable to connect to Zerodha. Please check your connection and try again.');
      }
    };

    connectSession();
  }, [location.search, navigate]);

  const handleRetry = () => {
    setError('');
    setIsConnecting(true);
    hasRequestedRef.current = false;
    window.location.reload();
  };

  return (
    <div className="zerodha-modal-screen">
      <div className="zerodha-modal-card">
        <div className="zerodha-modal-header">
          <div>
            <h1>Connect Zerodha</h1>
            <p className="zerodha-modal-subtitle">
              {error ? 'Connection failed' : status}
            </p>
          </div>
          <button
            type="button"
            className="zerodha-close-icon"
            onClick={() => navigate('/dashboard/nifty50')}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="zerodha-modal-body">
          {error ? (
            <p className="zerodha-modal-error">{error}</p>
          ) : (
            <>
              <div className="zerodha-loader" aria-hidden="true"></div>
              <p className="zerodha-modal-message">
                {isConnecting ? 'Please wait while we reach Zerodha.' : 'Redirecting to dashboard...'}
              </p>
            </>
          )}
        </div>
        <div className="zerodha-modal-footer">
          {error && (
            <button type="button" className="btn btn-outline" onClick={handleRetry}>
              Retry
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={() => navigate('/dashboard/nifty50')}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ZerodhaCallback;
