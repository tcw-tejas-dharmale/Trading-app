import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, BarChart3, Shield, Zap, ArrowRight, CheckCircle } from 'lucide-react';
import './HomePage.css';

const HomePage = () => {
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
              <Link to="/dashboard" className="btn btn-primary btn-large">
                Get Started
                <ArrowRight size={20} />
              </Link>
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

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why Choose WysTrade?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <BarChart3 size={32} className="feature-icon-large" />
              </div>
              <h3 className="feature-title">Advanced Charting</h3>
              <p className="feature-description">
                Interactive charts with multiple timeframes, indicators, and drawing tools 
                to help you make informed trading decisions.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Zap size={32} className="feature-icon-large" />
              </div>
              <h3 className="feature-title">Real-Time Data</h3>
              <p className="feature-description">
                Access live market data and historical information with low latency 
                to stay ahead of market movements.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <TrendingUp size={32} className="feature-icon-large" />
              </div>
              <h3 className="feature-title">Trading Strategies</h3>
              <p className="feature-description">
                Apply powerful trading strategies including Moving Averages, RSI, 
                and Bollinger Bands to identify opportunities.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Shield size={32} className="feature-icon-large" />
              </div>
              <h3 className="feature-title">Secure & Reliable</h3>
              <p className="feature-description">
                Your data is protected with industry-standard security measures 
                and our platform is built for reliability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Start Trading?</h2>
            <p className="cta-subtitle">
              Join thousands of traders using WysTrade to make smarter trading decisions.
            </p>
            <Link to="/dashboard" className="btn btn-primary btn-large">
              Explore the dashboard
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
