import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { fetchScales, fetchStrategies, fetchNiftyStocks, fetchBankNiftyStocks, fetchPositions, fetchHistoricalData } from '../services/api';
import CandlestickChart from './CandlestickChart';
import { Clock, Sliders, Search, Briefcase, X } from 'lucide-react';
import './EnhancedDashboard.css';

// --- Mini Chart Component ---
const MiniCandleChart = ({ candles }) => {
    const safeCandles = Array.isArray(candles) ? candles : [];
    if (safeCandles.length === 0) {
        return <div className="mini-chart text-secondary">No data</div>;
    }
    // Simple SVG rendering of 5 candles
    const width = 100;
    const height = 40;
    const candleWidth = 12;
    const gap = 6;

    // Find min/max for scaling
    let min = Infinity, max = -Infinity;
    safeCandles.forEach(c => {
        if (c.low < min) min = c.low;
        if (c.high > max) max = c.high;
    });
    const range = max - min || 1;

    const getY = (price) => height - ((price - min) / range) * height;

    return (
        <svg width={width} height={height} className="mini-chart">
            {safeCandles.map((c, i) => {
                const x = i * (candleWidth + gap) + 4;
                const yOpen = getY(c.open);
                const yClose = getY(c.close);
                const yHigh = getY(c.high);
                const yLow = getY(c.low);
                const isGreen = c.close >= c.open;
                const color = isGreen ? '#21c17a' : '#ef4444';

                return (
                    <g key={i}>
                        {/* Wick */}
                        <line x1={x + candleWidth / 2} y1={yHigh} x2={x + candleWidth / 2} y2={yLow} stroke={color} strokeWidth="1" />
                        {/* Body */}
                        <rect
                            x={x}
                            y={Math.min(yOpen, yClose)}
                            width={candleWidth}
                            height={Math.max(1, Math.abs(yOpen - yClose))}
                            fill={color}
                        />
                    </g>
                );
            })}
        </svg>
    );
};

const EnhancedDashboard = ({ selectedInstrument }) => {
    const excludedScales = new Set(['4h']);
    const preferredScales = ['1m', '5m', '15m', '30m', '1h', '1d', '2d', '1M'];
    const [scales, setScales] = useState(preferredScales);
    const [strategies, setStrategies] = useState([]);
    const [selectedScale, setSelectedScale] = useState('5m');
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [activeTab, setActiveTab] = useState('nifty'); // 'nifty', 'banknifty', 'openposition'

    const [niftyStocks, setNiftyStocks] = useState([]);
    const [bankNiftyStocks, setBankNiftyStocks] = useState([]);
    const [openPositions, setOpenPositions] = useState([]);

    // Modal State
    const [selectedStockForChart, setSelectedStockForChart] = useState(null);
    const [modalChartData, setModalChartData] = useState([]);

    // Routing hooks
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    // Function to refresh market data and positions
    const refreshData = async () => {
        try {
            const [nifty, bankNifty, positions] = await Promise.all([
                fetchNiftyStocks(),
                fetchBankNiftyStocks(),
                fetchPositions()
            ]);
            setNiftyStocks(nifty);
            setBankNiftyStocks(bankNifty);
            setOpenPositions(positions);
        } catch (error) {
            console.error("Failed to load market data", error);
            // Optionally, set to empty arrays or handle error state
            setNiftyStocks([]);
            setBankNiftyStocks([]);
            setOpenPositions([]);
        }
    };

    // 1. Initialize Options and initial data fetch
    useEffect(() => {
        const init = async () => {
            try {
                const [scalesData, strategiesData] = await Promise.all([
                    fetchScales().catch(() => preferredScales),
                    fetchStrategies()
                ]);

                const mergedScales = [...preferredScales].filter(scale => !excludedScales.has(scale));
                if (Array.isArray(scalesData)) {
                    scalesData.forEach((scale) => {
                        if (excludedScales.has(scale)) return;
                        if (!mergedScales.includes(scale)) mergedScales.push(scale);
                    });
                }
                setScales(mergedScales.filter(scale => !excludedScales.has(scale)));
                setStrategies(strategiesData || []); // Use fetched strategies or empty array

                // Set initial state from URL or defaults
                const urlScale = searchParams.get('scale');
                const urlStrategy = searchParams.get('strategy');

                if (urlScale && mergedScales.includes(urlScale)) {
                    setSelectedScale(urlScale);
                } else if (mergedScales.length > 0) {
                    setSelectedScale(mergedScales[1] || mergedScales[0]);
                }

                if (urlStrategy) {
                    setSelectedStrategy(urlStrategy);
                }

            } catch (error) {
                console.error("Failed to load dashboard options", error);
                setScales(preferredScales);
                setStrategies([]);
            }
        };

        init();
        refreshData(); // Initial fetch of market data
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Route Synchronization
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/dashboard/banknifty')) {
            setActiveTab('banknifty');
        } else if (path.includes('/dashboard/open-position')) {
            setActiveTab('openposition');
        } else {
            // Default or active state fallback
            if (path.includes('/dashboard/nifty50')) {
                setActiveTab('nifty');
            }
        }
    }, [location.pathname]);

    useEffect(() => {
        if (selectedScale && selectedStrategy) {
            setSearchParams({ scale: selectedScale, strategy: selectedStrategy }, { replace: true });
        }
        refreshData();
    }, [selectedScale, selectedStrategy, setSearchParams]);


    // Tab Handlers
    const handleTabClick = (tab, route) => {
        setActiveTab(tab);
        navigate(route);
    };

    const loadChartData = async (stock, scale) => {
        if (!stock) {
            setModalChartData([]);
            return;
        }
        const token = stock.instrument_token ?? stock.id;
        if (!token) {
            setModalChartData([]);
            return;
        }
        try {
            const data = await fetchHistoricalData(token, scale);
            setModalChartData(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load historical data", error);
            setModalChartData([]);
        }
    };

    const handleStockClick = async (stock) => {
        setSelectedStockForChart(stock);
        await loadChartData(stock, selectedScale);
    };

    // Update modal data when scale changes
    useEffect(() => {
        if (selectedStockForChart) {
            loadChartData(selectedStockForChart, selectedScale);
        }
    }, [selectedScale, selectedStockForChart]);

    const closeModal = () => {
        setSelectedStockForChart(null);
        setModalChartData([]);
    };

    const renderStockTable = (data) => (
        <div className="stock-table-container card">
            <div className="overflow-x-auto">
                <table className="enhanced-table">
                    <thead>
                        <tr>
                            <th style={{ width: '50px' }}>ID</th>
                            <th>Company Name</th>
                            <th>Candle Chart</th>
                            <th>Position</th>
                            <th className="text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item) => (
                            <tr key={item.id} className="stock-row">
                                <td>{item.id}</td>
                                <td className="font-bold">{item.name}</td>
                                <td
                                    className="mini-chart-cell cursor-pointer"
                                    onClick={() => handleStockClick(item)}
                                    title="Click to view full chart"
                                >
                                    <div className="mini-chart-wrapper">
                                        <MiniCandleChart candles={item.candles} />
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge ${item.position === 'Long' ? 'badge-success' :
                                        item.position === 'Short' ? 'badge-danger' : 'badge-neutral'
                                        }`}>
                                        {item.position}
                                    </span>
                                </td>
                                <td className="text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button className="btn btn-sm btn-primary">Buy</button>
                                        <button className="btn btn-sm btn-danger-outline">Sell</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="enhanced-dashboard container">
            {/* 1. Tabs */}
            <div className="instrument-tabs-section">
                <div className="instrument-tabs">
                    <button
                        className={`instrument-tab ${activeTab === 'nifty' ? 'active' : ''}`}
                        onClick={() => handleTabClick('nifty', '/dashboard/nifty50')}
                    >
                        📊 Nifty 50
                    </button>
                    <button
                        className={`instrument-tab ${activeTab === 'banknifty' ? 'active' : ''}`}
                        onClick={() => handleTabClick('banknifty', '/dashboard/banknifty')}
                    >
                        🏦 Bank Nifty
                    </button>
                    <button
                        className={`instrument-tab ${activeTab === 'openposition' ? 'active' : ''}`}
                        onClick={() => handleTabClick('openposition', '/dashboard/open-position')}
                    >
                        📈 Open Position
                    </button>
                </div>
            </div>

            {/* 2. Toolbar */}
            <div className="toolbar card">
                <div className="flex flex-wrap gap-6 items-center w-full">
                    <div className="control-group">
                        <label className="text-secondary text-sm flex items-center gap-2 mb-2">
                            <Clock size={16} /> Time Scale
                        </label>
                        <div className="flex gap-2 scale-buttons">
                            {scales.map(scale => (
                                <button
                                    key={scale}
                                    className={`btn text-sm ${selectedScale === scale ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setSelectedScale(scale)}
                                >
                                    {typeof scale === 'string' && scale.endsWith('d') ? scale.toUpperCase() : scale}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="spacer"></div>

                    <div className="control-group">
                        <label className="text-secondary text-sm flex items-center gap-2 mb-2">
                            <Sliders size={16} /> Strategy
                        </label>
                        <select
                            className="input"
                            value={selectedStrategy || ''}
                            onChange={(e) => setSelectedStrategy(e.target.value)}
                        >
                            <option value="" disabled>Select Strategy</option>
                            {strategies.map(strat => (
                                <option key={strat.id} value={strat.id}>{strat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="control-group">
                        <label className="text-secondary text-sm flex items-center gap-2 mb-2">
                            <Search size={16} /> Scan Stocks
                        </label>
                        <button
                            type="button"
                            className="btn btn-outline scan-stock-btn"
                            onClick={refreshData}
                        >
                            Run Scan
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Main Content Area */}
            <div className="dashboard-content-area">
                {activeTab === 'nifty' && (
                    <>
                        <div className="section-header">
                            <h2>Nifty 50 Constituents</h2>
                        </div>
                        {renderStockTable(niftyStocks)}
                    </>
                )}

                {activeTab === 'banknifty' && (
                    <>
                        <div className="section-header">
                            <h2>Bank Nifty Constituents</h2>
                        </div>
                        {renderStockTable(bankNiftyStocks)}
                    </>
                )}

                {activeTab === 'openposition' && (
                    <div className="open-positions-section card">
                        <div className="card-header">
                            <Briefcase size={24} className="card-icon" />
                            <h3 className="card-title">Open Positions</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="enhanced-table">
                                <thead>
                                    <tr>
                                        <th>Instrument</th>
                                        <th>Type</th>
                                        <th>Qty</th>
                                        <th>Avg Price</th>
                                        <th>LTP</th>
                                        <th>P&L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {openPositions.map((pos) => (
                                        <tr key={pos.id}>
                                            <td><strong>{pos.instrument}</strong></td>
                                            <td><span className={`badge ${pos.type === 'BUY' ? 'badge-success' : 'badge-neutral'}`}>{pos.type}</span></td>
                                            <td>{pos.qty}</td>
                                            <td>{pos.avgPrice.toFixed(2)}</td>
                                            <td>{pos.ltp.toFixed(2)}</td>
                                            <td>
                                                <span className={pos.pnl >= 0 ? 'text-success' : 'text-danger'}>
                                                    {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>


            {/* Modal for Detailed Chart */}
            {
                selectedStockForChart && (
                    <div className="modal-overlay">
                        <div className="modal-content card">
                            <div className="modal-header flex justify-between items-center mb-4">
                                <h2>{selectedStockForChart.name} - Detailed Analysis</h2>
                                <button className="btn-icon" onClick={closeModal}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="modal-body" style={{ height: '400px', width: '100%' }}>
                                <CandlestickChart
                                    data={modalChartData}
                                    label={selectedStockForChart.name}
                                    showVolume={true}
                                    showMovingAverage={true}
                                    scale={selectedScale}
                                />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default EnhancedDashboard;
