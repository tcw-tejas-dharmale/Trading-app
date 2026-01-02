import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { fetchScales, fetchStrategies, fetchNiftyStocks, fetchBankNiftyStocks, fetchPositions, fetchHoldings, fetchMargins, fetchQuote, fetchOrderMargins, fetchOrderStatus, fetchOrders, fetchHistoricalData, fetchZerodhaLoginUrl, syncInstruments, placeOrder } from '../services/api';
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

const EnhancedDashboard = () => {
    const excludedScales = useMemo(() => new Set(['4h']), []);
    const preferredScales = ['1m', '5m', '15m', '30m', '1h', '1d', '2d', '1M'];
    const [scales, setScales] = useState(preferredScales);
    const [strategies, setStrategies] = useState([]);
    const [scalesLoaded, setScalesLoaded] = useState(false);
    const [strategiesLoaded, setStrategiesLoaded] = useState(false);
    const [selectedScale, setSelectedScale] = useState('5m');
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [activeTab, setActiveTab] = useState('nifty'); // 'nifty', 'banknifty', 'openposition', 'holdings'

    const [niftyStocks, setNiftyStocks] = useState([]);
    const [bankNiftyStocks, setBankNiftyStocks] = useState([]);
    const [niftyQuery, setNiftyQuery] = useState({ page: 1, pageSize: 10, search: '', sortBy: 'name', sortDir: 'asc', position: '', category: '' });
    const [bankQuery, setBankQuery] = useState({ page: 1, pageSize: 10, search: '', sortBy: 'name', sortDir: 'asc', position: '' });
    const [niftyTotal, setNiftyTotal] = useState(0);
    const [bankTotal, setBankTotal] = useState(0);
    const [niftyError, setNiftyError] = useState('');
    const [bankError, setBankError] = useState('');
    const [openPositions, setOpenPositions] = useState([]);
    const [holdings, setHoldings] = useState([]);
    const [margins, setMargins] = useState(null);
    const [marginsError, setMarginsError] = useState('');
    const [niftyBlocked, setNiftyBlocked] = useState(false);
    const [bankBlocked, setBankBlocked] = useState(false);
    const [positionsBlocked, setPositionsBlocked] = useState(false);
    const [holdingsBlocked, setHoldingsBlocked] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [niftyCategory, setNiftyCategory] = useState('all');
    const [orderSubmittingId, setOrderSubmittingId] = useState(null);
    const [orderSubmittingAction, setOrderSubmittingAction] = useState(null);
    const [orderModal, setOrderModal] = useState(null);
    const [orderQuantity, setOrderQuantity] = useState(1);
    const [orderModalError, setOrderModalError] = useState('');
    const [orderType, setOrderType] = useState('MARKET');
    const [orderPrice, setOrderPrice] = useState('');
    const [orderVariety, setOrderVariety] = useState('regular');
    const [orderEstimate, setOrderEstimate] = useState(null);
    const [orderEstimateError, setOrderEstimateError] = useState('');
    const [livePrice, setLivePrice] = useState(null);
    const [lastOrderStatus, setLastOrderStatus] = useState(null);
    const [liveOrders, setLiveOrders] = useState([]);
    const orderStatusIntervalRef = useRef(null);
    const formatAmount = (value) => (Number.isFinite(value) ? Number(value).toFixed(2) : '--');
    const [zerodhaConnected, setZerodhaConnected] = useState(
        () => localStorage.getItem('zerodha_connected') === 'true'
    );

    // Modal State
    const [selectedStockForChart, setSelectedStockForChart] = useState(null);
    const [modalChartData, setModalChartData] = useState([]);

    // Routing hooks
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        setZerodhaConnected(localStorage.getItem('zerodha_connected') === 'true');
    }, [location.pathname]);

    // Function to refresh market data and positions
    const refreshPositions = useCallback(async () => {
        if (!zerodhaConnected) {
            setOpenPositions([]);
            setPositionsBlocked(true);
            return;
        }
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
    }, [positionsBlocked, zerodhaConnected]);

    const refreshHoldings = useCallback(async () => {
        if (!zerodhaConnected) {
            setHoldings([]);
            setHoldingsBlocked(true);
            return;
        }
        if (holdingsBlocked) return;
        try {
            const data = await fetchHoldings();
            setHoldings(data);
            setHoldingsBlocked(false);
        } catch (error) {
            console.error("Failed to load holdings", error);
            setHoldings([]);
            if (error?.response?.status === 403) {
                setHoldingsBlocked(true);
            }
        }
    }, [holdingsBlocked, zerodhaConnected]);

    const refreshMargins = useCallback(async () => {
        if (!zerodhaConnected) {
            setMargins(null);
            setMarginsError('Connect Zerodha to view balances.');
            return;
        }
        try {
            const data = await fetchMargins();
            setMargins(data);
            setMarginsError('');
        } catch (error) {
            console.error("Failed to load margins", error);
            setMargins(null);
            setMarginsError('Unable to load margins. Please connect Zerodha.');
        }
    }, [zerodhaConnected]);

    const refreshOrders = useCallback(async () => {
        try {
            const data = await fetchOrders();
            setLiveOrders(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load orders', error);
            setLiveOrders([]);
        }
    }, []);

    const fetchTableData = useCallback(async (segment) => {
        if (isConnecting) return;
        if (!zerodhaConnected) {
            if (segment === 'nifty') {
                setNiftyStocks([]);
                setNiftyTotal(0);
                setNiftyError('Connect Zerodha to load Nifty 50 data.');
                setNiftyBlocked(true);
            } else {
                setBankNiftyStocks([]);
                setBankTotal(0);
                setBankError('Connect Zerodha to load Bank Nifty data.');
                setBankBlocked(true);
            }
            return;
        }
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
            position: query.position || undefined,
            include_candles: true,
        };
        if (segment === 'nifty' && query.category) {
            params.category = query.category;
        }

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
    }, [bankBlocked, bankQuery, niftyBlocked, niftyQuery, selectedScale, isConnecting, zerodhaConnected]);

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

    useEffect(() => {
        refreshMargins();
        const interval = setInterval(() => {
            refreshMargins();
        }, 30000);
        return () => clearInterval(interval);
    }, [refreshMargins]);

    useEffect(() => {
        refreshOrders();
        const interval = setInterval(() => {
            refreshOrders();
        }, 5000);
        return () => clearInterval(interval);
    }, [refreshOrders]);

    // 2. Route Synchronization
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/dashboard/banknifty')) {
            setActiveTab('banknifty');
        } else if (path.includes('/dashboard/holdings')) {
            setActiveTab('holdings');
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

    const niftyCategories = [
        { id: 'all', label: 'Show All' },
        { id: 'it', label: 'IT' },
        { id: 'banks', label: 'Banks' },
        { id: 'healthcare', label: 'Healthcare' },
        { id: 'energy', label: 'Energy' },
        { id: 'fmcg', label: 'FMCG' },
        { id: 'auto', label: 'Auto' },
        { id: 'infra', label: 'Infra/Capital Goods' },
        { id: 'financials', label: 'Financial Services' },
        { id: 'metals', label: 'Metals/Mining' },
        { id: 'cement', label: 'Cement/Building' },
        { id: 'retail', label: 'Retail/Consumer' },
        { id: 'logistics', label: 'Logistics/Travel' },
        { id: 'food', label: 'Food/QSR' },
        { id: 'chemicals', label: 'Chemicals' },
        { id: 'telecom', label: 'Telecom/Exchange' },
        { id: 'realestate', label: 'Real Estate' },
    ];

    useEffect(() => {
        if (activeTab !== 'nifty' && activeTab !== 'banknifty') {
            return undefined;
        }
        if (isConnecting) {
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
    }, [activeTab, bankBlocked, fetchTableData, niftyBlocked, isConnecting]);

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
    }, [activeTab, positionsBlocked, refreshPositions]);

    useEffect(() => {
        if (activeTab !== 'holdings') {
            return undefined;
        }
        if (holdingsBlocked) {
            return undefined;
        }
        refreshHoldings();
        const interval = setInterval(() => {
            refreshHoldings();
        }, 15000);
        return () => clearInterval(interval);
    }, [activeTab, holdingsBlocked, refreshHoldings]);

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

    useEffect(() => {
        setNiftyQuery((prev) => ({
            ...prev,
            page: 1,
            category: niftyCategory === 'all' ? '' : niftyCategory,
        }));
    }, [niftyCategory]);

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

    const openOrderModal = (segment, action, item) => {
        setOrderModal({ segment, action, item });
        setOrderQuantity(1);
        setOrderModalError('');
        setOrderType('MARKET');
        setOrderPrice('');
        setOrderVariety('regular');
        setOrderEstimate(null);
        setOrderEstimateError('');
        setLivePrice(null);
    };

    const closeOrderModal = () => {
        setOrderModal(null);
        setOrderModalError('');
        setOrderEstimate(null);
        setOrderEstimateError('');
        setLivePrice(null);
    };

    const getOrderSymbol = (item) => (item?.tradingsymbol || item?.symbol || '').trim();

    const fetchLivePrice = useCallback(async (symbol) => {
        if (!symbol) return;
        try {
            const data = await fetchQuote(`NSE:${symbol}`);
            const quote = data?.[`NSE:${symbol}`];
            setLivePrice(quote?.last_price ?? null);
        } catch (error) {
            console.error('Failed to fetch live price', error);
            setLivePrice(null);
        }
    }, []);

    const estimateOrderMargins = useCallback(async (payload) => {
        try {
            const data = await fetchOrderMargins(payload);
            setOrderEstimate(data || null);
            setOrderEstimateError('');
        } catch (error) {
            console.error('Failed to fetch order margins', error);
            setOrderEstimate(null);
            setOrderEstimateError('Unable to estimate margins for this order.');
        }
    }, []);

    const stopOrderPolling = useCallback(() => {
        if (orderStatusIntervalRef.current) {
            clearInterval(orderStatusIntervalRef.current);
            orderStatusIntervalRef.current = null;
        }
    }, []);

    const pollOrderStatus = useCallback(async (orderId) => {
        if (!orderId) return;
        stopOrderPolling();
        const fetchStatus = async () => {
            try {
                const status = await fetchOrderStatus(orderId);
                setLastOrderStatus(status || null);
                const state = (status?.status || '').toUpperCase();
                if (['COMPLETE', 'REJECTED', 'CANCELLED'].includes(state)) {
                    stopOrderPolling();
                }
            } catch (error) {
                console.error('Failed to fetch order status', error);
            }
        };
        await fetchStatus();
        orderStatusIntervalRef.current = setInterval(fetchStatus, 5000);
    }, [stopOrderPolling]);

    const latestLiveOrder = useMemo(() => {
        if (!Array.isArray(liveOrders) || liveOrders.length === 0) return null;
        const sorted = [...liveOrders].sort((a, b) => {
            const aTime = new Date(a.order_timestamp || a.exchange_timestamp || 0).getTime();
            const bTime = new Date(b.order_timestamp || b.exchange_timestamp || 0).getTime();
            return bTime - aTime;
        });
        return sorted[0] || null;
    }, [liveOrders]);

    const orderPayload = useMemo(() => {
        if (!orderModal) return null;
        const symbol = getOrderSymbol(orderModal.item);
        const quantity = Number(orderQuantity);
        if (!symbol || !Number.isInteger(quantity) || quantity <= 0) {
            return null;
        }
        const payload = {
            tradingsymbol: symbol,
            quantity,
            transaction_type: orderModal.action,
            exchange: 'NSE',
            order_type: orderType,
            product: 'CNC',
            validity: 'DAY',
            variety: orderVariety,
        };
        if (orderType === 'LIMIT') {
            const price = Number(orderPrice);
            if (!Number.isFinite(price) || price <= 0) {
                return null;
            }
            payload.price = price;
        }
        return payload;
    }, [orderModal, orderQuantity, orderType, orderPrice, orderVariety]);

    useEffect(() => {
        if (!orderModal) return;
        const symbol = getOrderSymbol(orderModal.item);
        fetchLivePrice(symbol);
        const interval = setInterval(() => {
            fetchLivePrice(symbol);
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchLivePrice, orderModal]);

    useEffect(() => {
        if (!orderPayload) return;
        estimateOrderMargins(orderPayload);
    }, [estimateOrderMargins, orderPayload]);

    useEffect(() => {
        return () => {
            stopOrderPolling();
        };
    }, [stopOrderPolling]);

    const submitOrder = async () => {
        if (!orderModal) return;
        const { segment, action, item } = orderModal;
        const symbol = (item?.tradingsymbol || item?.symbol || '').trim();
        if (!symbol) {
            setOrderModalError('Missing trading symbol for this stock.');
            return;
        }
        const quantity = Number(orderQuantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            setOrderModalError('Quantity must be a positive integer.');
            return;
        }
        if (orderType === 'LIMIT') {
            const priceValue = Number(orderPrice);
            if (!Number.isFinite(priceValue) || priceValue <= 0) {
                setOrderModalError('Limit price must be a positive number.');
                return;
            }
        }
        const rowId = item.instrument_token || item.id || symbol;
        setOrderSubmittingId(rowId);
        setOrderSubmittingAction(action);
        setOrderModalError('');
        try {
            if (!orderPayload) {
                setOrderModalError('Invalid order payload.');
                return;
            }
            const result = await placeOrder(orderPayload);
            const orderId = result?.order_id;
            if (orderId) {
                setLastOrderStatus({ order_id: orderId, status: 'PENDING' });
                await pollOrderStatus(orderId);
            }
            await refreshPositions();
            await refreshHoldings();
            if (segment === 'nifty' || segment === 'banknifty') {
                await fetchTableData(segment);
            }
        } catch (error) {
            console.error(`Failed to place ${action} order`, error);
            const message = error?.response?.data?.detail || `Unable to place ${action} order.`;
            setOrderModalError(message);
            setSegmentError(segment, message);
        } finally {
            setOrderSubmittingId(null);
            setOrderSubmittingAction(null);
        }
    };

    const renderStockTable = (segment, data, query, setQuery, total, errorMessage, onDismissError) => (
        <div className="stock-table-container card">
            {!zerodhaConnected ? (
                <div className="empty-state">
                    <p>Connect Zerodha to load live market data and trade.</p>
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleConnectZerodha(segment)}
                        disabled={isConnecting}
                    >
                        {isConnecting ? 'Connecting...' : 'Connect Zerodha'}
                    </button>
                </div>
            ) : (
                <>
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
                    <label className="text-secondary text-sm">Position</label>
                    <select
                        className="input"
                        value={query.position}
                        onChange={(e) => setQuery((prev) => ({ ...prev, position: e.target.value, page: 1 }))}
                    >
                        <option value="">All</option>
                        <option value="Open">Open (Long/Short)</option>
                        <option value="Long">Long</option>
                        <option value="Short">Short</option>
                        <option value="Neutral">Neutral</option>
                    </select>
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
                            const symbol = item.tradingsymbol || item.symbol || '';
                            const symbolUrl = symbol ? `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}` : '';
                            const rowId = item.instrument_token || item.id || symbol;
                            const isSubmitting = orderSubmittingId === rowId;
                            return (
                                <tr key={item.instrument_token || item.id} className="stock-row">
                                    <td>{item.id || item.instrument_token}</td>
                                    <td className="font-bold">
                                        <div>{item.name || item.tradingsymbol}</div>
                                        {symbolUrl && (
                                            <a className="text-secondary text-sm" href={symbolUrl} target="_blank" rel="noreferrer">
                                                {symbol}
                                            </a>
                                        )}
                                    </td>
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
                                            <button
                                                className="btn btn-sm btn-primary"
                                                onClick={() => openOrderModal(segment, 'BUY', item)}
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting && orderSubmittingAction === 'BUY' ? 'Buying...' : 'Buy'}
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger-outline"
                                                onClick={() => openOrderModal(segment, 'SELL', item)}
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting && orderSubmittingAction === 'SELL' ? 'Selling...' : 'Sell'}
                                            </button>
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
                        {[10, 20, 50, 100, 200].map((size) => (
                            <option key={size} value={size}>{size} / page</option>
                        ))}
                    </select>
                </div>
            </div>
                </>
            )}
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
                    <button
                        className={`instrument-tab ${activeTab === 'holdings' ? 'active' : ''}`}
                        onClick={() => handleTabClick('holdings', '/dashboard/holdings')}
                    >
                        Holdings
                    </button>
                </div>
            </div>

            {/* 2. Toolbar */}
            {(activeTab === 'nifty' || activeTab === 'banknifty') && (
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
            )}

            {/* 3. Main Content Area */}
            <div className="dashboard-content-area">
                {activeTab === 'nifty' && (
                    <>
                        <div className="section-header">
                            <h2>Nifty 50 Constituents</h2>
                        </div>
                        {zerodhaConnected && (
                            <div className="card flex flex-wrap gap-2 items-center">
                                {niftyCategories.map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        className={`btn btn-sm ${niftyCategory === category.id ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setNiftyCategory(category.id)}
                                    >
                                        {category.label}
                                    </button>
                                ))}
                            </div>
                        )}
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

                {activeTab === 'holdings' && (
                    <div className="open-positions-section card">
                        <div className="card-header">
                            <Briefcase size={24} className="card-icon" />
                            <h3 className="card-title">Holdings</h3>
                        </div>
                        <div className="card" style={{ marginBottom: '1rem' }}>
                            <div className="card-header">
                                <Briefcase size={20} className="card-icon" />
                                <h3 className="card-title">Account Summary</h3>
                            </div>
                            {marginsError && <p className="text-danger text-sm">{marginsError}</p>}
                            <div className="flex flex-wrap gap-6">
                                <div>
                                    <p className="text-secondary text-sm">Available Cash</p>
                                    <strong>{formatAmount(margins?.equity?.available?.cash ?? margins?.equity?.available?.live_balance)}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Utilised</p>
                                    <strong>{formatAmount(margins?.equity?.utilised?.debits ?? margins?.equity?.utilised?.span)}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Net</p>
                                    <strong>{formatAmount(margins?.equity?.net)}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Order Margin (Latest)</p>
                                    <strong>{formatAmount(orderEstimate?.total)}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Estimated Charges</p>
                                    <strong>{formatAmount(orderEstimate?.charges?.total)}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Latest Order Status</p>
                                    <strong>{lastOrderStatus?.status || latestLiveOrder?.status || '--'}</strong>
                                </div>
                            </div>
                            {orderEstimateError && <p className="text-danger text-sm">{orderEstimateError}</p>}
                            {lastOrderStatus?.order_id && (
                                <p className="text-secondary text-sm">Order ID: {lastOrderStatus.order_id}</p>
                            )}
                            {!lastOrderStatus?.order_id && latestLiveOrder?.order_id && (
                                <p className="text-secondary text-sm">Order ID: {latestLiveOrder.order_id}</p>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="enhanced-table">
                                <thead>
                                    <tr>
                                        <th>Instrument</th>
                                        <th>Qty</th>
                                        <th>Avg Price</th>
                                        <th>LTP</th>
                                        <th>P&L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holdings.map((holding) => (
                                        <tr key={holding.id || holding.instrument}>
                                            <td><strong>{holding.instrument}</strong></td>
                                            <td>{holding.qty}</td>
                                            <td>{Number(holding.avgPrice || 0).toFixed(2)}</td>
                                            <td>{Number(holding.ltp || 0).toFixed(2)}</td>
                                            <td>
                                                <span className={holding.pnl >= 0 ? 'text-success' : 'text-danger'}>
                                                    {holding.pnl >= 0 ? '+' : ''}{Number(holding.pnl || 0).toFixed(2)}
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

            {orderModal && (
                <div className="modal-overlay">
                    <div className="modal-content card" style={{ width: 'min(520px, 92vw)' }}>
                        <div className="modal-header">
                            <h2>{orderModal.action} {orderModal?.item?.tradingsymbol || orderModal?.item?.symbol || ''}</h2>
                            <p className="modal-subtitle">Review order details and confirm.</p>
                        </div>
                        <div className="modal-body">
                            <div className="flex flex-wrap gap-4">
                                <div style={{ minWidth: '140px' }}>
                                    <label className="text-secondary text-sm">Quantity</label>
                                    <input
                                        className="input"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={orderQuantity}
                                        onChange={(e) => setOrderQuantity(e.target.value)}
                                    />
                                </div>
                                <div style={{ minWidth: '140px' }}>
                                    <label className="text-secondary text-sm">Order Type</label>
                                    <select
                                        className="input"
                                        value={orderType}
                                        onChange={(e) => setOrderType(e.target.value)}
                                    >
                                        <option value="MARKET">Market</option>
                                        <option value="LIMIT">Limit</option>
                                    </select>
                                </div>
                                <div style={{ minWidth: '140px' }}>
                                    <label className="text-secondary text-sm">Variety</label>
                                    <select
                                        className="input"
                                        value={orderVariety}
                                        onChange={(e) => setOrderVariety(e.target.value)}
                                    >
                                        <option value="regular">Regular</option>
                                        <option value="amo">AMO</option>
                                    </select>
                                </div>
                                {orderType === 'LIMIT' && (
                                    <div style={{ minWidth: '140px' }}>
                                        <label className="text-secondary text-sm">Limit Price</label>
                                        <input
                                            className="input"
                                            type="number"
                                            min="0"
                                            step="0.05"
                                            value={orderPrice}
                                            onChange={(e) => setOrderPrice(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="text-secondary text-sm" style={{ marginTop: '0.5rem' }}>
                                Live Price: {livePrice !== null ? formatAmount(livePrice) : '--'}
                            </div>
                            {orderModalError && <p className="text-danger text-sm">{orderModalError}</p>}
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button type="button" className="btn btn-outline" onClick={closeOrderModal}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={submitOrder}
                                disabled={orderSubmittingId !== null || !orderPayload || (orderType === 'LIMIT' && !orderPrice)}
                            >
                                {orderSubmittingAction === orderModal.action ? 'Placing...' : 'Confirm Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
            {isConnecting && (
                <div className="modal-overlay">
                    <div className="modal-content card" style={{ width: 'min(520px, 92vw)' }}>
                        <div className="modal-header">
                            <h2>Connecting to Zerodha...</h2>
                            <p className="modal-subtitle">Opening login in a moment.</p>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default EnhancedDashboard;
