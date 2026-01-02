import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { fetchScales, fetchStrategies, fetchNiftyStocks, fetchBankNiftyStocks, fetchPositions, fetchHistoricalData, fetchZerodhaLoginUrl, syncInstruments } from '../services/api';
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
    const [scalesLoaded, setScalesLoaded] = useState(false);
    const [strategiesLoaded, setStrategiesLoaded] = useState(false);
    const [selectedScale, setSelectedScale] = useState('5m');
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [activeTab, setActiveTab] = useState('nifty'); // 'nifty', 'banknifty', 'openposition'

    const [niftyStocks, setNiftyStocks] = useState([]);
    const [bankNiftyStocks, setBankNiftyStocks] = useState([]);
    const [niftyQuery, setNiftyQuery] = useState({ page: 1, pageSize: 10, search: '', sortBy: 'name', sortDir: 'asc' });
    const [bankQuery, setBankQuery] = useState({ page: 1, pageSize: 10, search: '', sortBy: 'name', sortDir: 'asc' });
    const [niftyTotal, setNiftyTotal] = useState(0);
    const [bankTotal, setBankTotal] = useState(0);
    const [niftyError, setNiftyError] = useState('');
    const [bankError, setBankError] = useState('');
    const [openPositions, setOpenPositions] = useState([]);
    const [niftyBlocked, setNiftyBlocked] = useState(false);
    const [bankBlocked, setBankBlocked] = useState(false);
    const [positionsBlocked, setPositionsBlocked] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Modal State
    const [selectedStockForChart, setSelectedStockForChart] = useState(null);
    const [modalChartData, setModalChartData] = useState([]);

    // Routing hooks
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    // Function to refresh market data and positions
    const refreshPositions = async () => {
        if (positionsBlocked) return;
        try {
            const positions = await fetchPositions();
            setOpenPositions(positions);
            setPositionsBlocked(false);
        } catch (error) {
            console.error("Failed to load market data", error);
            setOpenPositions([]);
            if (error?.response?.status === 403) {
                setPositionsBlocked(true);
            }
        }
    };

    const fetchTableData = useCallback(async (segment) => {
        if (segment === 'nifty' && niftyBlocked) return;
        if (segment === 'banknifty' && bankBlocked) return;
        const query = segment === 'nifty' ? niftyQuery : bankQuery;
        const params = {
            scale: selectedScale,
            search: query.search || undefined,
            sort_by: query.sortBy,
            sort_dir: query.sortDir,
            page: query.page,
            page_size: query.pageSize,
        };

        try {
            if (segment === 'nifty') {
                const response = await fetchNiftyStocks(params);
                setNiftyStocks(response.items || []);
                setNiftyTotal(response.total || 0);
                setNiftyError('');
                setNiftyBlocked(false);
            } else {
                const response = await fetchBankNiftyStocks(params);
                setBankNiftyStocks(response.items || []);
                setBankTotal(response.total || 0);
                setBankError('');
                setBankBlocked(false);
            }
        } catch (error) {
            console.error("Failed to load market data", error);
            const isForbidden = error?.response?.status === 403;
            if (segment === 'nifty') {
                setNiftyStocks([]);
                setNiftyTotal(0);
                setNiftyError('Unable to load Nifty 50 data. Please connect Zerodha and try again.');
                if (isForbidden) {
                    setNiftyBlocked(true);
                }
            } else {
                setBankNiftyStocks([]);
                setBankTotal(0);
                setBankError('Unable to load Bank Nifty data. Please connect Zerodha and try again.');
                if (isForbidden) {
                    setBankBlocked(true);
                }
            }
        }
    }, [bankBlocked, bankQuery, niftyBlocked, niftyQuery, selectedScale]);

    const mergeScales = useCallback((scaleList) => {
        if (!Array.isArray(scaleList)) return;
        setScales((prev) => {
            const merged = [...prev];
            scaleList.forEach((scale) => {
                if (excludedScales.has(scale)) return;
                if (!merged.includes(scale)) merged.push(scale);
            });
            return merged.filter(scale => !excludedScales.has(scale));
        });
    }, [excludedScales]);

    const ensureScalesLoaded = useCallback(async () => {
        if (scalesLoaded) return;
        setScalesLoaded(true);
        try {
            const scalesData = await fetchScales();
            mergeScales(scalesData);
        } catch (error) {
            console.error("Failed to load scales", error);
            setScalesLoaded(false);
        }
    }, [mergeScales, scalesLoaded]);

    const ensureStrategiesLoaded = useCallback(async () => {
        if (strategiesLoaded) return;
        setStrategiesLoaded(true);
        try {
            const strategiesData = await fetchStrategies();
            setStrategies(strategiesData || []);
        } catch (error) {
            console.error("Failed to load strategies", error);
            setStrategiesLoaded(false);
        }
    }, [strategiesLoaded]);

    // 1. Initialize Options and initial data fetch
    useEffect(() => {
        const init = async () => {
            try {
                const mergedScales = [...preferredScales].filter(scale => !excludedScales.has(scale));

                // Set initial state from URL or defaults
                const urlScale = searchParams.get('scale');
                const urlStrategy = searchParams.get('strategy');

                if (urlScale && !excludedScales.has(urlScale)) {
                    if (!mergedScales.includes(urlScale)) {
                        mergedScales.push(urlScale);
                    }
                    setSelectedScale(urlScale);
                } else if (mergedScales.length > 0) {
                    setSelectedScale(mergedScales[1] || mergedScales[0]);
                }

                if (urlStrategy) {
                    setSelectedStrategy(urlStrategy);
                }

                setScales(mergedScales);
            } catch (error) {
                console.error("Failed to load dashboard options", error);
                setScales(preferredScales);
            }
        };

        init();
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

    const latestCandle = modalChartData.length > 0 ? modalChartData[modalChartData.length - 1] : null;
    const priceChange = latestCandle ? latestCandle.close - latestCandle.open : null;
    const priceChangePct = latestCandle ? (priceChange / latestCandle.open) * 100 : null;

    useEffect(() => {
        if (activeTab === 'nifty' || activeTab === 'banknifty') {
            fetchTableData(activeTab);
        }
    }, [activeTab, fetchTableData, bankBlocked, niftyBlocked]);

    useEffect(() => {
        if (activeTab !== 'nifty' && activeTab !== 'banknifty') {
            return undefined;
        }
        if (activeTab === 'nifty' && niftyBlocked) {
            return undefined;
        }
        if (activeTab === 'banknifty' && bankBlocked) {
            return undefined;
        }
        const interval = setInterval(() => {
            fetchTableData(activeTab);
        }, 15000);
        return () => clearInterval(interval);
    }, [activeTab, bankBlocked, fetchTableData, niftyBlocked]);

    useEffect(() => {
        if (activeTab !== 'openposition') {
            return undefined;
        }
        if (positionsBlocked) {
            return undefined;
        }
        refreshPositions();
        const interval = setInterval(() => {
            refreshPositions();
        }, 15000);
        return () => clearInterval(interval);
    }, [activeTab, positionsBlocked]);

    const dismissNiftyError = () => {
        setNiftyError('');
        setNiftyBlocked(false);
        fetchTableData('nifty');
    };

    const dismissBankError = () => {
        setBankError('');
        setBankBlocked(false);
        fetchTableData('banknifty');
    };

    const setSegmentError = (segment, message) => {
        if (segment === 'banknifty') {
            setBankError(message);
        } else {
            setNiftyError(message);
        }
    };

    const handleSyncInstruments = async (segment) => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            await syncInstruments();
            await fetchTableData(segment);
        } catch (error) {
            console.error("Failed to sync instruments", error);
            setSegmentError(segment, 'Unable to sync instruments. Please try again.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleConnectZerodha = async (segment) => {
        if (isConnecting) return;
        setIsConnecting(true);
        try {
            const response = await fetchZerodhaLoginUrl();
            if (!response?.login_url) {
                throw new Error('Missing Zerodha login URL');
            }
            window.location.assign(response.login_url);
        } catch (error) {
            console.error("Failed to start Zerodha login", error);
            setSegmentError(segment, 'Unable to start Zerodha login. Please try again.');
        } finally {
            setIsConnecting(false);
        }
    };

    const renderStockTable = (segment, data, query, setQuery, total, errorMessage, onDismissError) => (
        <div className="stock-table-container card">
            <div className="table-toolbar">
                <div className="table-search">
                    <label className="text-secondary text-sm">Filter</label>
                    <input
                        className="input"
                        placeholder="Search by name or symbol"
                        value={query.search}
                        onChange={(e) => setQuery((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                    />
                </div>
                <div className="table-sort">
                    <label className="text-secondary text-sm">Sort by</label>
                    <select
                        className="input"
                        value={query.sortBy}
                        onChange={(e) => setQuery((prev) => ({ ...prev, sortBy: e.target.value }))}
                    >
                        <option value="name">Company Name</option>
                        <option value="id">ID</option>
                        <option value="price">Last Price</option>
                        <option value="position">Position</option>
                    </select>
                </div>
                <div className="table-sort">
                    <label className="text-secondary text-sm">Order</label>
                    <select
                        className="input"
                        value={query.sortDir}
                        onChange={(e) => setQuery((prev) => ({ ...prev, sortDir: e.target.value }))}
                    >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>
            </div>
            {errorMessage && (
                <div className="instrument-message instrument-error dismissible" role="alert">
                    <span>{errorMessage}</span>
                    <button
                        type="button"
                        className="error-dismiss"
                        aria-label="Dismiss error"
                        onClick={onDismissError}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
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
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="table-empty">
                                    <div className="empty-state">
                                        <p>No stocks yet. Sync instruments or connect Zerodha to load live data.</p>
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline"
                                                onClick={() => handleSyncInstruments(segment)}
                                                disabled={isSyncing}
                                            >
                                                {isSyncing ? 'Syncing...' : 'Sync instruments'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-primary"
                                                onClick={() => handleConnectZerodha(segment)}
                                                disabled={isConnecting}
                                            >
                                                {isConnecting ? 'Connecting...' : 'Connect Zerodha'}
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {data.map((item) => {
                            const position = item.position || 'Neutral';
                            return (
                                <tr key={item.instrument_token || item.id} className="stock-row">
                                    <td>{item.id || item.instrument_token}</td>
                                    <td className="font-bold">{item.name || item.tradingsymbol}</td>
                                    <td
                                        className="mini-chart-cell cursor-pointer"
                                        onClick={() => handleStockClick(item)}
                                        title="Click to view full chart"
                                    >
                                        <div className="mini-chart-wrapper">
                                            <MiniCandleChart candles={item.candles || []} />
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${position === 'Long' ? 'badge-success' :
                                            position === 'Short' ? 'badge-danger' : 'badge-neutral'
                                            }`}>
                                            {position}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <button className="btn btn-sm btn-primary">Buy</button>
                                            <button className="btn btn-sm btn-danger-outline">Sell</button>
                                            <button className="btn btn-sm btn-outline">Modify</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="table-pagination">
                <div className="text-secondary text-sm">
                    Showing {total === 0 ? 0 : (query.page - 1) * query.pageSize + 1}-
                    {Math.min(query.page * query.pageSize, total)} of {total}
                </div>
                <div className="pagination-controls">
                    <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={query.page === 1}
                    >
                        Prev
                    </button>
                    <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setQuery((prev) => ({ ...prev, page: prev.page + 1 }))}
                        disabled={query.page * query.pageSize >= total}
                    >
                        Next
                    </button>
                    <select
                        className="input"
                        value={query.pageSize}
                        onChange={(e) => setQuery((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                    >
                        {[10, 20, 30, 50].map((size) => (
                            <option key={size} value={size}>{size} / page</option>
                        ))}
                    </select>
                </div>
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
                                    onClick={() => {
                                        ensureScalesLoaded();
                                        setSelectedScale(scale);
                                    }}
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
                            onFocus={ensureStrategiesLoaded}
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
                            onClick={refreshPositions}
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
                        {renderStockTable(
                            'nifty',
                            niftyStocks,
                            niftyQuery,
                            setNiftyQuery,
                            niftyTotal,
                            niftyError,
                            dismissNiftyError
                        )}
                    </>
                )}

                {activeTab === 'banknifty' && (
                    <>
                        <div className="section-header">
                            <h2>Bank Nifty Constituents</h2>
                        </div>
                        {renderStockTable(
                            'banknifty',
                            bankNiftyStocks,
                            bankQuery,
                            setBankQuery,
                            bankTotal,
                            bankError,
                            dismissBankError
                        )}
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
                                <div>
                                    <h2>{selectedStockForChart.name} - Detailed Analysis</h2>
                                    <p className="modal-subtitle">Live candlestick view with trade overlays</p>
                                </div>
                                <button className="btn-icon" onClick={closeModal}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="modal-meta">
                                <div className="meta-item">
                                    <span>Timeframe</span>
                                    <strong>{typeof selectedScale === 'string' && selectedScale.endsWith('d') ? selectedScale.toUpperCase() : selectedScale}</strong>
                                </div>
                                <div className="meta-item">
                                    <span>Last Close</span>
                                    <strong>{latestCandle ? latestCandle.close.toFixed(2) : '--'}</strong>
                                </div>
                                <div className={`meta-item ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                                    <span>Change</span>
                                    <strong>
                                        {priceChange !== null ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}` : '--'}
                                        {priceChangePct !== null ? ` (${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}%)` : ''}
                                    </strong>
                                </div>
                                <div className="meta-item">
                                    <span>Volume</span>
                                    <strong>{Number.isFinite(latestCandle?.volume) ? latestCandle.volume.toLocaleString() : '--'}</strong>
                                </div>
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
