import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createZerodhaSession } from '../services/api';
import './ZerodhaCallback.css';

const ZerodhaCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Connecting to Zerodha...');
  const [error, setError] = useState('');
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestToken = params.get('request_token');

    if (!requestToken) {
      setStatus('');
      setError('Missing request token. Please retry the Zerodha login.');
      return;
    }
    if (hasRequestedRef.current) {
      return;
    }
    hasRequestedRef.current = true;

    const connect = async () => {
      try {
        await createZerodhaSession(requestToken);
        setStatus('Zerodha connected. Redirecting to dashboard...');
        setTimeout(() => navigate('/dashboard/nifty50'), 1200);
      } catch (err) {
        console.error('Failed to connect Zerodha session', err);
        setStatus('');
        setError('Unable to connect Zerodha. Please try again.');
      }
    };

    connect();
  }, [location.search, navigate]);

  return (
    <div className="zerodha-callback">
      <div className="zerodha-callback-card card">
        <h2>Zerodha Connection</h2>
        {status && <p className="zerodha-status">{status}</p>}
        {error && <p className="zerodha-error">{error}</p>}
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('/dashboard/nifty50')}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ZerodhaCallback;
