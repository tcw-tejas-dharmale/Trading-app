import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchCurrentUser } from '../services/api';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const handleGetStarted = async (event) => {
    event.preventDefault();
    if (loading) {
      return;
    }
    if (!user?.token) {
      navigate('/login');
      return;
    }
    try {
      await fetchCurrentUser();
      navigate('/dashboard');
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404) {
        navigate('/signup');
      } else if (status === 401) {
        navigate('/login');
      } else {
        navigate('/signup');
      }
    }
  };

  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Master the Markets with
              <span className="gradient-text"> Precision Trading</span>
            </h1>
            <p className="hero-subtitle">
              Advanced charting, real-time market data, and powerful trading strategies
              at your fingertips. Start trading smarter today.
            </p>
            <div className="hero-cta">
              <button type="button" className="btn btn-primary btn-large" onClick={handleGetStarted}>
                Get Started
                <ArrowRight size={20} />
              </button>
            </div>
            <div className="hero-features">
              <div className="hero-feature-item">
                <CheckCircle size={20} className="feature-icon" />
                <span>No signup required</span>
              </div>
              <div className="hero-feature-item">
                <CheckCircle size={20} className="feature-icon" />
                <span>Real-time data</span>
              </div>
              <div className="hero-feature-item">
                <CheckCircle size={20} className="feature-icon" />
                <span>Advanced analytics</span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
