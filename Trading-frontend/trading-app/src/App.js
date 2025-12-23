import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
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
            <Dashboard selectedInstrument={selectedInstrument} />
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
