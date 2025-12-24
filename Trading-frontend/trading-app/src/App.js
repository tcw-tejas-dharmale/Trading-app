import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import HomePage from './components/HomePage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import HelpPage from './pages/HelpPage';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  const [selectedInstrument, setSelectedInstrument] = useState(null);

  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Navbar
            selectedInstrument={selectedInstrument}
            onInstrumentChange={setSelectedInstrument}
          />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route 
                path="/dashboard" 
                element={<Dashboard selectedInstrument={selectedInstrument} />} 
              />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/help" element={<HelpPage />} />
              {/* Placeholder routes for footer links */}
              <Route path="/about" element={<HelpPage />} />
              <Route path="/contact" element={<HelpPage />} />
              <Route path="/privacy" element={<HelpPage />} />
              <Route path="/terms" element={<HelpPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
