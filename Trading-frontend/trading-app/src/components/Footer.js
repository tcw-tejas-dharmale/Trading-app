import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Twitter, Linkedin, Facebook, Github } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Footer.css';

const Footer = () => {
  const { user, logout } = useAuth();

  return (
    <footer className="footer">
      <div className="footer-container container">
        <div className="footer-content">
          {/* Brand Section */}
          <div className="footer-section">
            <div className="footer-logo">
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 16l5-5 4 4 7-8" />
                  <path d="M4 20h16" opacity="0.6" />
                </svg>
              </span>
              <span className="brand-name footer-logo-text">WyseTrade</span>
            </div>
            <p className="footer-description">
              Advanced trading platform with real-time market data, powerful analytics, and intuitive charting tools.
            </p>
            <div className="footer-social">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <Twitter size={20} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <Linkedin size={20} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <Github size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h3 className="footer-heading">Quick Links</h3>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/profile">Profile</Link></li>
              <li><Link to="/help">Help & Support</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="footer-section">
            <h3 className="footer-heading">Company</h3>
            <ul className="footer-links">
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contact">Contact Us</Link></li>
              <li><a href="#careers">Careers</a></li>
              <li><a href="#blog">Blog</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="footer-section">
            <h3 className="footer-heading">Legal</h3>
            <ul className="footer-links">
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><a href="#cookies">Cookie Policy</a></li>
              <li><a href="#disclaimer">Disclaimer</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="footer-section">
            <h3 className="footer-heading">Contact Us</h3>
            <ul className="footer-contact">
              <li>
                <Mail size={16} className="footer-contact-icon" />
                <a href="mailto:support@wysetrade.com">support@wysetrade.com</a>
              </li>
              <li>
                <span className="footer-contact-icon">📞</span>
                <a href="tel:+1234567890">+1 (234) 567-890</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} WyseTrade. All rights reserved.</p>
          <p className="footer-disclaimer">
            Trading involves substantial risk of loss. Please trade responsibly.
          </p>
          <div className="footer-actions">
            {user ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
                Log out
              </button>
            ) : (
              <Link to="/login" className="btn btn-outline btn-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

