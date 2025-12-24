import React from 'react';
import EnhancedDashboard from './EnhancedDashboard';
import './Dashboard.css';

const Dashboard = ({ selectedInstrument }) => {
    // Use Enhanced Dashboard for comprehensive financial analysis
    return <EnhancedDashboard selectedInstrument={selectedInstrument} />;
};

export default Dashboard;
