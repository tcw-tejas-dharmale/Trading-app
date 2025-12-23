import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchScales, fetchStrategies, fetchHistoricalData } from '../services/api';
import ChartComponent from './ChartComponent';
import { Clock, Sliders, TrendingUp, Lock } from 'lucide-react';
import './Dashboard.css';

const Dashboard = ({ selectedInstrument }) => {
    const { user } = useAuth();
    const [scales, setScales] = useState([]);
    const [strategies, setStrategies] = useState([]);
    const [selectedScale, setSelectedScale] = useState('5m');
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [marketData, setMarketData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            loadOptions();
        }
    }, [user]);

    useEffect(() => {
        if (user && selectedInstrument && selectedScale) {
            loadData();
        }
    }, [user, selectedInstrument, selectedScale, selectedStrategy]);

    const loadOptions = async () => {
        try {
            const [scalesData, strategiesData] = await Promise.all([
                fetchScales(),
                fetchStrategies()
            ]);
            setScales(scalesData);
            setStrategies(strategiesData);
            if (scalesData.length > 0) setSelectedScale(scalesData[1] || scalesData[0]); // Default to 5m if available
            if (strategiesData.length > 0) setSelectedStrategy(strategiesData[0].id);
        } catch (error) {
            console.error("Failed to load dashboard options", error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchHistoricalData(selectedInstrument.instrument_token, selectedScale);
            setMarketData(data);
        } catch (error) {
            console.error("Failed to load market data", error);
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="landing-page container">
                <div className="hero-section">
                    <h1 className="hero-title">Master the Markets with Precision</h1>
                    <p className="hero-subtitle">Advanced charting, real-time data, and powerful strategies at your fingertips.</p>

                    <div className="demo-visuals">
                        <div className="card blur-overlay">
                            <div className="flex justify-between mb-4">
                                <div className="placeholder-text w-32"></div>
                                <div className="placeholder-text w-16"></div>
                            </div>
                            <div className="chart-placeholder">
                                <TrendingUp size={64} className="text-accent opacity-50" />
                                <div className="lock-icon">
                                    <Lock size={32} />
                                    <span>Login to view charts</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard container">
            <div className="toolbar card">
                <div className="flex flex-wrap gap-6 items-center w-full">
                    {/* Scale Selector - Top Left */}
                    <div className="control-group">
                        <label className="text-secondary text-sm flex items-center gap-2 mb-2">
                            <Clock size={16} /> Time Scale
                        </label>
                        <div className="flex gap-2">
                            {scales.map(scale => (
                                <button
                                    key={scale}
                                    className={`btn text-sm ${selectedScale === scale ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setSelectedScale(scale)}
                                >
                                    {scale}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="spacer"></div>

                    {/* Strategy Selector - Top Right */}
                    <div className="control-group">
                        <label className="text-secondary text-sm flex items-center gap-2 mb-2">
                            <Sliders size={16} /> Strategy
                        </label>
                        <select
                            className="input"
                            value={selectedStrategy || ''}
                            onChange={(e) => setSelectedStrategy(e.target.value)}
                        >
                            {strategies.map(strat => (
                                <option key={strat.id} value={strat.id}>{strat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="main-viz-area">
                <div className="chart-container card">
                    {loading ? (
                        <div className="loading-state">Loading data...</div>
                    ) : (
                        <div style={{ height: '400px' }}>
                            <ChartComponent
                                data={marketData}
                                label={`${selectedInstrument?.name} - ${selectedScale}`}
                            />
                        </div>
                    )}
                </div>

                {/* Data Table */}
                <div className="data-table-container card mt-4">
                    <h3 className="text-lg font-bold mb-4">Market Data</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-secondary border-b border-border">
                                    <th className="p-2">Time</th>
                                    <th className="p-2">Open</th>
                                    <th className="p-2">High</th>
                                    <th className="p-2">Low</th>
                                    <th className="p-2">Close</th>
                                    <th className="p-2">Volume</th>
                                </tr>
                            </thead>
                            <tbody>
                                {marketData.slice(0, 5).map((row, idx) => (
                                    <tr key={idx} className="border-b border-border hover:bg-slate-800">
                                        <td className="p-2">{new Date(row.date).toLocaleString()}</td>
                                        <td className="p-2">{row.open}</td>
                                        <td className="p-2">{row.high}</td>
                                        <td className="p-2">{row.low}</td>
                                        <td className="p-2">{row.close}</td>
                                        <td className="p-2">{row.volume}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
