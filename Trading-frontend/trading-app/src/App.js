import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import EnhancedDashboard from './components/EnhancedDashboard';
import HomePage from './components/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfilePage from './pages/ProfilePage';
import ZerodhaCallback from './pages/ZerodhaCallback';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/signup" replace />;
  }

  return children;
};

const AppLayout = () => {
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const location = useLocation();
  const hideNavbar = location.pathname.startsWith('/zerodha/callback');

  return (
    <div className="App">
      {!hideNavbar && (
        <Navbar
          selectedInstrument={selectedInstrument}
          onInstrumentChange={setSelectedInstrument}
        />
      )}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <EnhancedDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/zerodha/callback" element={<ZerodhaCallback />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}

export default App;
