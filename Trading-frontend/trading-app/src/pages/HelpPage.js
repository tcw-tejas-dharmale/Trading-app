import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Book, MessageCircle, Mail, Search } from 'lucide-react';
import './HelpPage.css';

const HelpPage = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      id: 1,
      question: 'How do I get started with WyseTrade?',
      answer: 'You can start using WyseTrade immediately without signing up. Simply navigate to the Dashboard to view market data and charts. If you want to save your preferences, you can optionally create an account.'
    },
    {
      id: 2,
      question: 'What data sources does WyseTrade use?',
      answer: 'WyseTrade displays market data provided by the backend services you configure. Connect a real data provider to enable live feeds.'
    },
    {
      id: 3,
      question: 'What trading strategies are available?',
      answer: 'WyseTrade supports several trading strategies including Moving Average Crossover, RSI Strategy, and Bollinger Bands. You can select and apply these strategies from the Dashboard to analyze market trends.'
    },
    {
      id: 4,
      question: 'How do I change the time scale on charts?',
      answer: 'Use the time scale selector in the Dashboard toolbar. Available options include 1m, 5m, 15m, 30m, 1h, 4h, and 1d (daily). Select the scale that best fits your analysis needs.'
    },
    {
      id: 5,
      question: 'Is my data secure?',
      answer: 'Yes, WyseTrade implements industry-standard security measures to protect your data. All communications are encrypted, and we follow best practices for data protection and privacy.'
    },
    {
      id: 6,
      question: 'Can I use WyseTrade on mobile devices?',
      answer: 'Yes, WyseTrade is fully responsive and works on mobile devices, tablets, and desktops. The interface adapts to different screen sizes for optimal viewing experience.'
    }
  ];

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  return (
    <div className="help-page">
      <div className="container">
        <div className="help-header">
          <h1 className="page-title">Help & Support</h1>
          <p className="page-subtitle">Find answers to common questions and get assistance</p>
        </div>

        {/* Search Section */}
        <div className="help-search-section">
          <div className="search-wrapper">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search for help topics..."
              className="help-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Links */}
        <div className="help-quick-links">
          <div className="quick-link-card">
            <HelpCircle size={32} className="quick-link-icon" />
            <h3 className="quick-link-title">FAQs</h3>
            <p className="quick-link-text">Browse frequently asked questions</p>
          </div>
          <div className="quick-link-card">
            <Book size={32} className="quick-link-icon" />
            <h3 className="quick-link-title">Documentation</h3>
            <p className="quick-link-text">Learn how to use all features</p>
          </div>
          <div className="quick-link-card">
            <MessageCircle size={32} className="quick-link-icon" />
            <h3 className="quick-link-title">Contact Support</h3>
            <p className="quick-link-text">Get help from our team</p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="faq-section">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {filteredFaqs.map((faq) => (
              <div key={faq.id} className="faq-item">
                <button
                  className="faq-question"
                  onClick={() => toggleFaq(faq.id)}
                >
                  <span>{faq.question}</span>
                  {openFaq === faq.id ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </button>
                {openFaq === faq.id && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="contact-section">
          <div className="contact-card card">
            <Mail size={32} className="contact-icon" />
            <h3 className="contact-title">Still need help?</h3>
            <p className="contact-text">
              Our support team is here to assist you. Reach out to us via email or check our documentation for more information.
            </p>
            <div className="contact-actions">
              <a href="mailto:support@wysetrade.com" className="btn btn-primary">
                Email Support
              </a>
              <a href="/dashboard" className="btn btn-outline">
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;

