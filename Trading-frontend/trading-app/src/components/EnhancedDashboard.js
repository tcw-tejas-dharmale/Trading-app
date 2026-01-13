import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { fetchNiftyStocks, fetchBankNiftyStocks, fetchPositions, fetchHoldings, fetchQuote, fetchMargins, fetchOrderMargins, fetchOrderStatus, fetchOrders, fetchHistoricalData, fetchZerodhaLoginUrl, placeOrder, tradeExecute, fetchInstruments } from '../services/api';
import { subscribeMarketTicks } from '../services/marketWs';
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
    const preferredScales = useMemo(() => ['1m', '5m', '15m', '30m', '1h', '1d', '2d', '1M'], []);
    const scales = useMemo(() => preferredScales.filter(scale => !excludedScales.has(scale)), [preferredScales, excludedScales]);
    const [selectedScale, setSelectedScale] = useState('5m');
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [activeTab, setActiveTab] = useState('nifty'); // 'nifty', 'banknifty', 'openposition', 'holdings'

    const [niftyStocks, setNiftyStocks] = useState([]);
    const [bankNiftyStocks, setBankNiftyStocks] = useState([]);
    const [niftyQuery, setNiftyQuery] = useState({ page: 1, pageSize: 10, search: '', position: '', category: '' });
    const [bankQuery, setBankQuery] = useState({ page: 1, pageSize: 10, search: '', position: '' });
    const [niftyTotal, setNiftyTotal] = useState(0);
    const [bankTotal, setBankTotal] = useState(0);
    const [niftyError, setNiftyError] = useState('');
    const [bankError, setBankError] = useState('');
    const [openPositions, setOpenPositions] = useState([]);
    const [holdings, setHoldings] = useState([]);
    const [instrumentNameBySymbol, setInstrumentNameBySymbol] = useState({});
    const [niftyBlocked, setNiftyBlocked] = useState(false);
    const [bankBlocked, setBankBlocked] = useState(false);
    const [positionsBlocked, setPositionsBlocked] = useState(false);
    const [holdingsBlocked, setHoldingsBlocked] = useState(false);
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
    const [orderIntent, setOrderIntent] = useState('delivery'); // delivery (CNC) | intraday (MIS)
    const [orderTicket, setOrderTicket] = useState('regular'); // quick | regular
    const [orderAdvanced, setOrderAdvanced] = useState(true);
    const [orderStopEnabled, setOrderStopEnabled] = useState(false);
    const [orderStopType, setOrderStopType] = useState('SL-M'); // SL | SL-M
    const [orderStopPercent, setOrderStopPercent] = useState(-5);
    const [orderTargetEnabled, setOrderTargetEnabled] = useState(false);
    const [orderTargetPercent, setOrderTargetPercent] = useState(5);
    const [orderAccountRisk, setOrderAccountRisk] = useState(500);
    const [orderCloseTargetForMis, setOrderCloseTargetForMis] = useState(false);
    const [marginSummary, setMarginSummary] = useState(null);
    const [marginSummaryError, setMarginSummaryError] = useState('');
    const [orderEstimate, setOrderEstimate] = useState(null);
    const [orderEstimateError, setOrderEstimateError] = useState('');
    const [livePrice, setLivePrice] = useState(null);
    const [lastOrderStatus, setLastOrderStatus] = useState(null);
    const [recentPurchase, setRecentPurchase] = useState(null);
    const [orderToast, setOrderToast] = useState(null);
    const [liveOrders, setLiveOrders] = useState([]);
    const orderStatusIntervalRef = useRef(null);
    const formatAmount = (value) => (Number.isFinite(value) ? Number(value).toFixed(2) : '--');
    const holdingsTotals = useMemo(() => {
        let profit = 0;
        let loss = 0;
        (Array.isArray(holdings) ? holdings : []).forEach((holding) => {
            const pnl = Number(holding?.pnl);
            if (!Number.isFinite(pnl) || pnl === 0) return;
            if (pnl > 0) profit += pnl;
            else loss += Math.abs(pnl);
        });
        return { profit, loss, net: profit - loss };
    }, [holdings]);
    const [orderRecommendation, setOrderRecommendation] = useState({ label: '—', detail: '', tone: 'neutral' });
    const candleRecoCacheRef = useRef(new Map());
    const [zerodhaConnected, setZerodhaConnected] = useState(
        () => localStorage.getItem('zerodha_connected') === 'true'
    );
    const [connectModalOpen, setConnectModalOpen] = useState(false);
    const [connectStatus, setConnectStatus] = useState('idle'); // idle | loading | error
    const [connectError, setConnectError] = useState('');
    const connectTimerRef = useRef(null);
    const [connectionSuccessAnimation, setConnectionSuccessAnimation] = useState({
        nifty: false,
        banknifty: false
    });
    const prevConnectionStatusRef = useRef(zerodhaConnected);

    // Modal State
    const [selectedStockForChart, setSelectedStockForChart] = useState(null);
    const [modalChartData, setModalChartData] = useState([]);

    // Routing hooks
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const sleep = useCallback((ms) => new Promise((resolve) => setTimeout(resolve, ms)), []);
    
    useEffect(() => {
        const isConnected = localStorage.getItem('zerodha_connected') === 'true';
        const wasConnected = prevConnectionStatusRef.current;
        
        // Detect when connection becomes active
        if (!wasConnected && isConnected) {
            // Trigger animation for both sections since connection affects both
            setConnectionSuccessAnimation({ nifty: true, banknifty: true });
            // Remove animation classes after animation completes
            setTimeout(() => {
                setConnectionSuccessAnimation({ nifty: false, banknifty: false });
            }, 2000);
        }
        
        setZerodhaConnected(isConnected);
        prevConnectionStatusRef.current = isConnected;
    }, [location.pathname]);

    useEffect(() => {
        const focus = (searchParams.get('focus') || '').trim();
        const orderId = (searchParams.get('order') || '').trim();
        if (!focus) return;
        setRecentPurchase({ instrument: focus, orderId: orderId || null, ts: Date.now() });
    }, [searchParams]);

    // Also listen for storage changes (in case connection happens in another tab)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'zerodha_connected') {
                const isConnected = e.newValue === 'true';
                const wasConnected = prevConnectionStatusRef.current;
                
                if (!wasConnected && isConnected) {
                    setConnectionSuccessAnimation({ nifty: true, banknifty: true });
                    setTimeout(() => {
                        setConnectionSuccessAnimation({ nifty: false, banknifty: false });
                    }, 2000);
                }
                
                setZerodhaConnected(isConnected);
                prevConnectionStatusRef.current = isConnected;
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

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

    const refreshInstruments = useCallback(async () => {
        try {
            const data = await fetchInstruments();
            const nextMap = {};
            (Array.isArray(data) ? data : []).forEach((inst) => {
                const symbol = (inst?.tradingsymbol || '').trim();
                if (!symbol) return;
                nextMap[symbol.toUpperCase()] = inst?.name || symbol;
            });
            setInstrumentNameBySymbol(nextMap);
        } catch (error) {
            console.error('Failed to load instruments', error);
            setInstrumentNameBySymbol({});
        }
    }, []);

    const refreshOrders = useCallback(async () => {
        if (!zerodhaConnected) {
            setLiveOrders([]);
            return;
        }
        try {
            const data = await fetchOrders();
            setLiveOrders(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load orders', error);
            setLiveOrders([]);
        }
    }, [zerodhaConnected]);

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
    }, [bankBlocked, bankQuery, isConnecting, niftyBlocked, niftyQuery, selectedScale, zerodhaConnected]);
    const fetchTableDataRef = useRef(fetchTableData);
    useEffect(() => {
        fetchTableDataRef.current = fetchTableData;
    }, [fetchTableData]);


    // 1. Initialize Options and initial data fetch
    useEffect(() => {
        // Set initial state from URL or defaults
        const urlScale = searchParams.get('scale');
        const urlStrategy = searchParams.get('strategy');

        if (urlScale && !excludedScales.has(urlScale) && scales.includes(urlScale)) {
            setSelectedScale(urlScale);
        } else if (scales.length > 0) {
            setSelectedScale(scales[1] || scales[0]);
        }

        if (urlStrategy) {
            setSelectedStrategy(urlStrategy);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        refreshInstruments();
    }, [refreshInstruments]);

    useEffect(() => {
        if (!zerodhaConnected) {
            setLiveOrders([]);
            return;
        }
        refreshOrders();
    }, [refreshOrders, zerodhaConnected]);

    useEffect(() => {
        if (activeTab !== 'holdings') return;
        if (!zerodhaConnected) return;
        refreshOrders();
    }, [activeTab, refreshOrders, zerodhaConnected]);

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

    const normalizeChartData = useCallback((candles) => {
        if (!Array.isArray(candles)) return [];
        return [...candles]
            .filter((entry) => entry && entry.date)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, []);

    const getHistoryRange = useCallback((scale) => {
        const daysByScale = {
            "1m": 5,
            "5m": 10,
            "15m": 30,
            "30m": 60,
            "1h": 120,
            "1d": 365,
            "2d": 730,
            "1M": 1825,
        };
        const days = daysByScale[scale] || 30;
        const end = new Date();
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        return { start: start.toISOString(), end: end.toISOString() };
    }, []);

    const loadChartData = useCallback(async (stock, scale) => {
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
            const range = getHistoryRange(scale);
            const data = await fetchHistoricalData(token, scale, range);
            setModalChartData(normalizeChartData(data));
        } catch (error) {
            console.error("Failed to load historical data", error);
            setModalChartData([]);
        }
    }, [getHistoryRange, normalizeChartData]);

    const handleStockClick = async (stock) => {
        setSelectedStockForChart(stock);
        await loadChartData(stock, selectedScale);
    };

    // Update modal data when scale changes
    useEffect(() => {
        if (!selectedStockForChart) return undefined;
        let active = true;
        const refresh = async () => {
            if (!active) return;
            await loadChartData(selectedStockForChart, selectedScale);
        };
        refresh();
        const interval = setInterval(refresh, 15000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [loadChartData, selectedScale, selectedStockForChart]);

    const closeModal = () => {
        setSelectedStockForChart(null);
        setModalChartData([]);
    };

    const latestCandle = modalChartData.length > 0 ? modalChartData[modalChartData.length - 1] : null;
    const priceChange = latestCandle ? latestCandle.close - latestCandle.open : null;
    const priceChangePct = latestCandle ? (priceChange / latestCandle.open) * 100 : null;

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
        let isActive = true;
        const run = () => {
            if (!isActive) {
                return;
            }
            fetchTableDataRef.current(activeTab);
        };
        run();
        const interval = setInterval(run, 15000);
        return () => {
            isActive = false;
            clearInterval(interval);
        };
    }, [
        activeTab,
        bankBlocked,
        bankQuery,
        isConnecting,
        niftyBlocked,
        niftyQuery,
        selectedScale,
        zerodhaConnected,
    ]);

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
        const nextCategory = niftyCategory === 'all' ? '' : niftyCategory;
        setNiftyQuery((prev) => {
            if (prev.page === 1 && prev.category === nextCategory) {
                return prev;
            }
            return {
                ...prev,
                page: 1,
                category: nextCategory,
            };
        });
    }, [niftyCategory]);

    const setSegmentError = (segment, message) => {
        if (segment === 'banknifty') {
            setBankError(message);
        } else {
            setNiftyError(message);
        }
    };

    const closeConnectModal = () => {
        if (connectTimerRef.current) {
            clearTimeout(connectTimerRef.current);
            connectTimerRef.current = null;
        }
        setConnectModalOpen(false);
        setConnectStatus('idle');
        setConnectError('');
        setIsConnecting(false);
    };

    const handleConnectZerodha = async (segment) => {
        if (isConnecting) return;
        if (connectTimerRef.current) {
            clearTimeout(connectTimerRef.current);
            connectTimerRef.current = null;
        }
        setIsConnecting(true);
        setConnectModalOpen(true);
        setConnectStatus('loading');
        setConnectError('');
        try {
            const response = await fetchZerodhaLoginUrl();
            if (!response?.login_url) {
                throw new Error('Missing Zerodha login URL');
            }
            connectTimerRef.current = setTimeout(() => {
                setIsConnecting(false);
                window.location.assign(response.login_url);
            }, 10000);
        } catch (error) {
            console.error("Failed to start Zerodha login", error);
            setConnectStatus('error');
            setConnectError('Unable to connect. Please try again.');
            setSegmentError(segment, 'Unable to start Zerodha login. Please try again.');
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
        setOrderIntent('delivery');
        setOrderTicket('regular');
        setOrderAdvanced(true);
        setOrderStopEnabled(false);
        setOrderStopType('SL-M');
        setOrderStopPercent(-5);
        setOrderTargetEnabled(false);
        setOrderTargetPercent(5);
        setOrderAccountRisk(500);
        setOrderCloseTargetForMis(false);
        setMarginSummary(null);
        setMarginSummaryError('');
        setOrderEstimate(null);
        setOrderEstimateError('');
        const fallbackPrice = Number(item?.price);
        setLivePrice(Number.isFinite(fallbackPrice) ? fallbackPrice : null);
        setOrderRecommendation({ label: '—', detail: '', tone: 'neutral' });
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
            const nextPrice = quote?.last_price;
            if (Number.isFinite(nextPrice)) {
                setLivePrice(nextPrice);
            }
        } catch (error) {
            console.error('Failed to fetch live price', error);
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
                return status || null;
            } catch (error) {
                console.error('Failed to fetch order status', error);
                return null;
            }
        };
        const first = await fetchStatus();
        orderStatusIntervalRef.current = setInterval(fetchStatus, 5000);
        return first;
    }, [stopOrderPolling]);

    const waitForTerminalOrderStatus = useCallback(async (orderId, timeoutMs = 60000) => {
        if (!orderId) return null;
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            const status = await fetchOrderStatus(orderId);
            setLastOrderStatus(status || null);
            const state = (status?.status || '').toUpperCase();
            if (['COMPLETE', 'REJECTED', 'CANCELLED'].includes(state)) {
                return status || null;
            }
            await sleep(2000);
        }
        return lastOrderStatus;
    }, [lastOrderStatus, sleep]);

    const latestLiveOrder = useMemo(() => {
        if (!Array.isArray(liveOrders) || liveOrders.length === 0) return null;
        const sorted = [...liveOrders].sort((a, b) => {
            const aTime = new Date(a.order_timestamp || a.exchange_timestamp || 0).getTime();
            const bTime = new Date(b.order_timestamp || b.exchange_timestamp || 0).getTime();
            return bTime - aTime;
        });
        return sorted[0] || null;
    }, [liveOrders]);

    const holdingsOrderHistory = useMemo(() => {
        if (!Array.isArray(liveOrders) || liveOrders.length === 0) return [];
        const sorted = [...liveOrders].sort(
            (a, b) =>
                new Date(b.order_timestamp || b.exchange_timestamp || 0).getTime() -
                new Date(a.order_timestamp || a.exchange_timestamp || 0).getTime()
        );
        const holdingSet = new Set(holdings.map((h) => (h?.instrument || '').toUpperCase()).filter(Boolean));
        const filtered = sorted.filter((o) => holdingSet.has((o?.tradingsymbol || '').toUpperCase()));
        // If holdings haven't updated yet, show all recent orders so the user still sees the latest trade.
        return (filtered.length ? filtered : sorted).slice(0, 25);
    }, [holdings, liveOrders]);

    const recentHolding = useMemo(() => {
        if (!recentPurchase?.instrument) return null;
        return (
            holdings.find(
                (h) => (h?.instrument || '').toUpperCase() === recentPurchase.instrument.toUpperCase()
            ) || null
        );
    }, [holdings, recentPurchase]);

    const orderPayload = useMemo(() => {
        if (!orderModal) return null;
        const symbol = getOrderSymbol(orderModal.item);
        const quantity = Number(orderQuantity);
        if (!symbol || !Number.isInteger(quantity) || quantity <= 0) {
            return null;
        }
        const product = orderIntent === 'intraday' ? 'MIS' : 'CNC';

        const ticket = (orderTicket || 'regular').toLowerCase();
        const resolvedOrderType = ticket === 'quick' ? 'MARKET' : orderType;
        const resolvedVariety = ticket === 'quick' ? 'regular' : orderVariety;
        const payload = {
            tradingsymbol: symbol,
            quantity,
            transaction_type: orderModal.action,
            exchange: 'NSE',
            order_type: resolvedOrderType,
            product,
            validity: 'DAY',
        };
        payload.variety = resolvedVariety;
        if (payload.order_type === 'LIMIT') {
            const price = Number(orderPrice);
            if (!Number.isFinite(price) || price <= 0) {
                return null;
            }
            payload.price = price;
        }
        return payload;
    }, [orderModal, orderQuantity, orderType, orderPrice, orderVariety, orderIntent, orderTicket]);

    const computeRecommendationFromCandles = useCallback((candles) => {
        const series = Array.isArray(candles) ? candles : [];
        const closes = series.map((c) => Number(c?.close)).filter((v) => Number.isFinite(v));
        if (closes.length < 60) {
            return {
                label: 'Neutral',
                detail: 'Not enough candle history.',
                tone: 'neutral',
                metrics: null,
            };
        }

        const sma = (arr, period) => {
            if (arr.length < period) return null;
            const window = arr.slice(-period);
            return window.reduce((a, b) => a + b, 0) / period;
        };

        const emaSeries = (arr, period) => {
            if (arr.length < period) return null;
            const k = 2 / (period + 1);
            const out = [];
            let prev = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
            out.push(prev);
            for (let i = period; i < arr.length; i += 1) {
                prev = (arr[i] - prev) * k + prev;
                out.push(prev);
            }
            return out;
        };

        const rsi = (arr, period = 14) => {
            if (arr.length < period + 1) return null;
            let gains = 0;
            let losses = 0;
            for (let i = arr.length - period; i < arr.length; i += 1) {
                const diff = arr[i] - arr[i - 1];
                if (diff >= 0) gains += diff;
                else losses += Math.abs(diff);
            }
            const avgGain = gains / period;
            const avgLoss = losses / period;
            if (avgLoss === 0) return 100;
            const rs = avgGain / avgLoss;
            return 100 - (100 / (1 + rs));
        };

        const sma20 = sma(closes, 20);
        const sma50 = sma(closes, 50);
        const rsi14 = rsi(closes, 14);

        const ema12 = emaSeries(closes, 12);
        const ema26 = emaSeries(closes, 26);
        if (!ema12 || !ema26) {
            return { label: 'Neutral', detail: 'Unable to compute indicators.', tone: 'neutral', metrics: null };
        }
        const macdLine = ema12.slice(ema12.length - ema26.length).map((v, idx) => v - ema26[idx]);
        const signal = emaSeries(macdLine, 9);
        const macd = macdLine[macdLine.length - 1];
        const sig = signal ? signal[signal.length - 1] : null;
        const hist = sig !== null ? macd - sig : null;
        const prevMacd = macdLine.length >= 2 ? macdLine[macdLine.length - 2] : null;
        const prevSig = signal && signal.length >= 2 ? signal[signal.length - 2] : null;
        const macdBullCross = prevMacd !== null && prevSig !== null && prevMacd <= prevSig && macd > sig;
        const macdBearCross = prevMacd !== null && prevSig !== null && prevMacd >= prevSig && macd < sig;

        const lastClose = closes[closes.length - 1];
        const priorSma20 = closes.length >= 25 ? sma(closes.slice(0, closes.length - 5), 20) : null;
        const trendUp = Number.isFinite(sma20) && Number.isFinite(sma50) && lastClose > sma20 && sma20 > sma50 && (priorSma20 ? sma20 > priorSma20 : true);
        const trendDown = Number.isFinite(sma20) && Number.isFinite(sma50) && lastClose < sma20 && sma20 < sma50 && (priorSma20 ? sma20 < priorSma20 : true);

        const last = series[series.length - 1];
        const prev = series[series.length - 2];
        const bullishEngulfing = (() => {
            if (!last || !prev) return false;
            const prevBear = Number(prev.close) < Number(prev.open);
            const currBull = Number(last.close) > Number(last.open);
            return prevBear && currBull && Number(last.open) <= Number(prev.close) && Number(last.close) >= Number(prev.open);
        })();
        const bearishEngulfing = (() => {
            if (!last || !prev) return false;
            const prevBull = Number(prev.close) > Number(prev.open);
            const currBear = Number(last.close) < Number(last.open);
            return prevBull && currBear && Number(last.open) >= Number(prev.close) && Number(last.close) <= Number(prev.open);
        })();

        let score = 0;
        if (trendUp) score += 2;
        if (trendDown) score -= 2;
        if (bullishEngulfing) score += 1;
        if (bearishEngulfing) score -= 1;
        if (macdBullCross) score += 1;
        if (macdBearCross) score -= 1;
        if (Number.isFinite(rsi14)) {
            if (rsi14 > 55) score += 0.5;
            if (rsi14 < 45) score -= 0.5;
            if (rsi14 >= 70) score -= 0.5;
            if (rsi14 <= 30) score += 0.25;
        }

        let label = 'Neutral';
        let tone = 'neutral';
        if (score >= 2) {
            label = 'Buy';
            tone = 'positive';
        } else if (score <= -2) {
            label = 'Avoid';
            tone = 'negative';
        }

        const pattern = bullishEngulfing ? 'Bullish engulfing' : bearishEngulfing ? 'Bearish engulfing' : 'None';
        const detailParts = [];
        if (trendUp) detailParts.push('Uptrend');
        if (trendDown) detailParts.push('Downtrend');
        if (pattern !== 'None') detailParts.push(pattern);
        if (macdBullCross) detailParts.push('MACD bullish crossover');
        if (macdBearCross) detailParts.push('MACD bearish crossover');
        const detail = detailParts.length ? detailParts.join(', ') : 'Mixed/sideways signals.';

        return {
            label,
            detail,
            tone,
            metrics: {
                sma20,
                sma50,
                rsi14,
                macd,
                signal: sig,
                hist,
                pattern,
                score,
            },
        };
    }, []);

    useEffect(() => {
        if (!orderModal) return undefined;
        const symbol = getOrderSymbol(orderModal.item);
        if (!symbol) return undefined;
        fetchLivePrice(symbol);
        (async () => {
            try {
                const margins = await fetchMargins();
                setMarginSummary(margins || null);
                setMarginSummaryError('');
            } catch (error) {
                setMarginSummary(null);
                setMarginSummaryError('Unable to fetch available funds.');
            }
        })();
        const unsubscribe = subscribeMarketTicks((ticks) => {
            const match = ticks.find((tick) => tick.symbol === symbol);
            if (match && Number.isFinite(match.ltp)) {
                setLivePrice(match.ltp);
            }
        });

        (async () => {
            try {
                const token = orderModal?.item?.instrument_token || orderModal?.item?.id;
                if (!token) return;
                const cached = candleRecoCacheRef.current.get(token);
                if (cached) {
                    setOrderRecommendation(cached);
                    return;
                }
                const candles = Array.isArray(orderModal?.item?.candles) && orderModal.item.candles.length
                    ? orderModal.item.candles
                    : await fetchHistoricalData(token, '1d', '', '');
                const reco = computeRecommendationFromCandles(candles);
                candleRecoCacheRef.current.set(token, reco);
                setOrderRecommendation(reco);
            } catch (error) {
                setOrderRecommendation({ label: 'Neutral', detail: 'Candle analysis unavailable.', tone: 'neutral' });
            }
        })();

        return () => unsubscribe();
    }, [fetchLivePrice, orderModal, computeRecommendationFromCandles]);

    useEffect(() => {
        if (orderType !== 'LIMIT') return;
        if (orderPrice !== '') return;
        if (!Number.isFinite(livePrice)) return;
        setOrderPrice(Number(livePrice).toFixed(2));
    }, [livePrice, orderPrice, orderType]);

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
            const useBracket = orderTicket === 'regular' && action === 'BUY' && (orderStopEnabled || orderTargetEnabled);
            let result = null;
            if (useBracket) {
                if (!orderStopEnabled) {
                    setOrderModalError('Enable Stoploss to use automated stoploss/target.');
                    return;
                }
                if (orderType !== 'MARKET') {
                    setOrderModalError('Stoploss/Target automation currently supports MARKET entry only.');
                    return;
                }
                const ltp = Number.isFinite(livePrice) ? Number(livePrice) : Number(item?.price);
                if (!Number.isFinite(ltp) || ltp <= 0) {
                    setOrderModalError('Live price is required for stoploss/target.');
                    return;
                }
                const risk = Number(orderAccountRisk);
                if (!Number.isFinite(risk) || risk <= 0) {
                    setOrderModalError('Account risk must be a positive number.');
                    return;
                }
                const slPercent = Math.abs(Number(orderStopPercent));
                if (!Number.isFinite(slPercent) || slPercent <= 0) {
                    setOrderModalError('Stoploss % must be a positive number.');
                    return;
                }
                const targetPct = Math.abs(Number(orderTargetPercent));
                const targetPrice = orderTargetEnabled ? (ltp * (1 + targetPct / 100)) : null;

                const payload = {
                    preview: {
                        tradingsymbol: symbol,
                        exchange: 'NSE',
                        ltp,
                        intent: orderIntent === 'intraday' ? 'intraday' : 'delivery',
                        account_risk_inr: risk,
                        quantity_override: Number(orderQuantity),
                        stop_loss_method: 'percent',
                        stop_loss_percent: slPercent,
                        sl_order_type: orderStopType,
                        target_price: targetPrice,
                        target_mode: orderCloseTargetForMis ? 'close' : 'limit',
                        use_close_target_for_mis: Boolean(orderCloseTargetForMis),
                    },
                    confirm: true,
                };

                result = await tradeExecute(payload);
                if (result?.decision !== 'BUY') {
                    setOrderModalError(result?.reason || 'NO_BUY');
                    return;
                }
            } else {
                result = await placeOrder(orderPayload);
            }
            const orderId = result?.order_id || result?.entry_order_id;
            let finalOrderStatus = null;
            if (orderId) {
                setLastOrderStatus({ order_id: orderId, status: 'PENDING' });
                pollOrderStatus(orderId);
                finalOrderStatus = await waitForTerminalOrderStatus(orderId);
            }
            await refreshPositions();
            await refreshHoldings();
            await refreshOrders();
            if (segment === 'nifty' || segment === 'banknifty') {
                await fetchTableData(segment);
            }

            const normalizedAction = (action || '').toUpperCase();
            const normalizedStatus = (finalOrderStatus?.status || '').toUpperCase();
            if (normalizedAction === 'BUY' && normalizedStatus === 'COMPLETE') {
                setOrderToast({
                    message: `Order purchased: ${symbol}`,
                    ts: Date.now(),
                });
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    const matched = holdings.find((h) => (h?.instrument || '').toUpperCase() === symbol.toUpperCase());
                    if (matched) break;
                    await sleep(1000);
                    await refreshHoldings();
                }
                setRecentPurchase({ instrument: symbol, orderId: orderId || null, ts: Date.now() });
                setActiveTab('holdings');
                setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('focus', symbol);
                    if (orderId) next.set('order', orderId);
                    return next;
                });
                navigate('/dashboard/holdings');
                closeOrderModal();
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

    const renderStockTable = (segment, data, query, setQuery, total, errorMessage, onDismissError) => {
        const isAnimating = connectionSuccessAnimation[segment];
        const recos = (data || [])
            .map((item) => computeRecommendationFromCandles(item?.candles || [])?.label)
            .filter(Boolean);
        const uniqueReco = Array.from(new Set(recos));
        return (
            <div className={`stock-table-container card ${isAnimating ? 'connection-success-animation' : ''}`}>
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
                ) : isAnimating ? (
                    <div className="connection-success-state">
                        <div className="connection-success-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="success-circle"/>
                                <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="success-check"/>
                            </svg>
                        </div>
                        <h3 className="connection-success-title">
                            {segment === 'nifty' ? 'Nifty 50' : 'Bank Nifty'} Connected!
                        </h3>
                        <p className="connection-success-message">Zerodha is now connected. Loading market data...</p>
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
                        <option value="Long">Long</option>
                        <option value="Short">Short</option>
                        <option value="Neutral">Neutral</option>
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
                            <th>Reco</th>
                            <th className="text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="table-empty">
                                    <div className="empty-state">
                                        <p>No stocks yet connect Zerodha to load live data.</p>
                                        <div className="flex justify-center">
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
                            const analysis = computeRecommendationFromCandles(item.candles || []);
                            const metrics = analysis?.metrics;
                            const tooltip = metrics
                                ? `SMA20=${Number(metrics.sma20).toFixed(2)} SMA50=${Number(metrics.sma50).toFixed(2)} RSI14=${Number(metrics.rsi14).toFixed(1)} MACD=${Number(metrics.macd).toFixed(3)}/${Number(metrics.signal).toFixed(3)} Pattern=${metrics.pattern}`
                                : (analysis?.detail || '');
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
                                    <td title={tooltip}>
                                        <span className={`analysis-badge analysis-${(analysis?.label || 'Neutral').toLowerCase()}`}>
                                            {analysis?.label || 'Neutral'}
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
            {uniqueReco.length === 1 && uniqueReco[0] ? (
                <div className="text-secondary text-sm" style={{ marginTop: '0.5rem' }}>
                    All stocks in this view: <strong>{uniqueReco[0]}</strong>
                </div>
            ) : null}
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
    };

    return (
        <div className="enhanced-dashboard container">
            {orderToast?.message && (
                <div
                    className="card"
                    style={{
                        position: 'fixed',
                        top: 16,
                        right: 16,
                        zIndex: 9999,
                        minWidth: 280,
                        border: '1px solid rgba(34,197,94,0.35)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <strong>{orderToast.message}</strong>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setOrderToast(null)}
                            aria-label="Close"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
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
                                onChange={(e) => setSelectedStrategy(e.target.value)}
                                disabled
                            >
                                <option value="">No strategies available</option>
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
                              <div className="card flex flex-wrap gap-2 items-center category-toolbar">
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
                                <h3 className="card-title">Holdings Summary</h3>
                            </div>
                            <div className="flex flex-wrap gap-6">
                                <div>
                                    <p className="text-secondary text-sm">Status</p>
                                    <strong>{lastOrderStatus?.status || latestLiveOrder?.status || '--'}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Order ID</p>
                                    <strong>{lastOrderStatus?.order_id || latestLiveOrder?.order_id || '--'}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Total Loss</p>
                                    <strong>{formatAmount(holdingsTotals.loss)}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Total Profit</p>
                                    <strong>{formatAmount(holdingsTotals.profit)}</strong>
                                </div>
                                <div>
                                    <p className="text-secondary text-sm">Net P&L</p>
                                    <strong className={holdingsTotals.net >= 0 ? 'text-success' : 'text-danger'}>
                                        {holdingsTotals.net >= 0 ? '+' : ''}{formatAmount(holdingsTotals.net)}
                                    </strong>
                                </div>
                            </div>
                        </div>
                        {recentPurchase?.instrument && (
                            <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.35)' }}>
                                <div className="card-header">
                                    <h3 className="card-title">Purchase Complete</h3>
                                </div>
                                <div className="flex flex-wrap gap-6" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <strong>{recentPurchase.instrument}</strong>
                                        {recentPurchase.orderId ? (
                                            <span className="text-secondary" style={{ marginLeft: 8 }}>
                                                Order ID: {recentPurchase.orderId}
                                            </span>
                                        ) : null}
                                        {recentHolding ? (
                                            <div className="text-secondary text-sm" style={{ marginTop: 6 }}>
                                                Qty {recentHolding.qty} · Avg {Number(recentHolding.avgPrice || 0).toFixed(2)} · LTP{' '}
                                                {Number(recentHolding.ltp || 0).toFixed(2)} · P&L {Number(recentHolding.pnl || 0).toFixed(2)}
                                            </div>
                                        ) : (
                                            <div className="text-secondary text-sm" style={{ marginTop: 6 }}>
                                                Holding details may take a few seconds to appear. Try refreshing Holdings.
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline"
                                        onClick={() => {
                                            setRecentPurchase(null);
                                            setSearchParams((prev) => {
                                                const next = new URLSearchParams(prev);
                                                next.delete('focus');
                                                next.delete('order');
                                                return next;
                                            });
                                        }}
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="overflow-x-auto">
                            <table className="enhanced-table">
                                <thead>
                                    <tr>
                                        <th>Instrument</th>
                                        <th>Company</th>
                                        <th>Qty</th>
                                        <th>Avg Price</th>
                                        <th>Invested</th>
                                        <th>LTP</th>
                                        <th>P&L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holdings.map((holding) => (
                                        <tr
                                            key={holding.id || holding.instrument}
                                            style={
                                                recentPurchase?.instrument &&
                                                (holding?.instrument || '').toUpperCase() === recentPurchase.instrument.toUpperCase()
                                                    ? { background: 'rgba(34, 197, 94, 0.08)' }
                                                    : undefined
                                            }
                                        >
                                            <td><strong>{holding.instrument}</strong></td>
                                            <td>{instrumentNameBySymbol[(holding.instrument || '').toUpperCase()] || holding.instrument}</td>
                                            <td>{holding.qty}</td>
                                            <td>{Number(holding.avgPrice || 0).toFixed(2)}</td>
                                            <td>{(Number(holding.qty || 0) * Number(holding.avgPrice || 0)).toFixed(2)}</td>
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

                        <div className="card" style={{ marginTop: '1rem' }}>
                            <div className="card-header">
                                <h3 className="card-title">Recent Order History</h3>
                            </div>
                            {holdingsOrderHistory.length === 0 ? (
                                <p className="text-secondary text-sm">No recent orders found for current holdings.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="enhanced-table">
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>Type</th>
                                                <th>Instrument</th>
                                                <th>Company</th>
                                                <th>Qty</th>
                                                <th>Avg Price</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {holdingsOrderHistory.map((order) => {
                                                const symbol = (order?.tradingsymbol || '').trim();
                                                const company = instrumentNameBySymbol[symbol.toUpperCase()] || symbol;
                                                const t = order?.order_timestamp || order?.exchange_timestamp || order?.exchange_update_timestamp;
                                                const ts = t ? new Date(t).toLocaleString() : '--';
                                                const qty = order?.filled_quantity ?? order?.quantity ?? '--';
                                                const avg = order?.average_price ?? '--';
                                                return (
                                                    <tr key={order?.order_id || `${symbol}-${t}`}>
                                                        <td>{ts}</td>
                                                        <td>
                                                            <span className={`badge ${(order?.transaction_type || '').toUpperCase() === 'BUY' ? 'badge-success' : 'badge-neutral'}`}>
                                                                {(order?.transaction_type || '--').toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td><strong>{symbol || '--'}</strong></td>
                                                        <td>{company}</td>
                                                        <td>{qty}</td>
                                                        <td>{Number.isFinite(Number(avg)) ? Number(avg).toFixed(2) : avg}</td>
                                                        <td>{(order?.status || '--').toUpperCase()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {orderModal && (
                <div className="modal-overlay">
                    <div className="modal-content card kite-order-modal" style={{ width: 'min(520px, 92vw)' }}>
                        <div className="modal-header">
                            <h2>{orderModal.action} {orderModal?.item?.tradingsymbol || orderModal?.item?.symbol || ''}</h2>
                            <p className="modal-subtitle">Review order details and confirm.</p>
                        </div>
                        <div className="modal-body">
                            <div className="kite-ticket-header">
                                <div className="kite-ticket-tabs">
                                    {['quick', 'regular'].map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            className={`kite-ticket-tab ${orderTicket === tab ? 'active' : ''}`}
                                            onClick={() => {
                                                setOrderTicket(tab);
                                                if (tab === 'quick') {
                                                    setOrderType('MARKET');
                                                }
                                            }}
                                        >
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="kite-advanced-toggle"
                                    onClick={() => setOrderAdvanced((prev) => !prev)}
                                >
                                    Advanced <span className={`kite-caret ${orderAdvanced ? 'open' : ''}`}>▾</span>
                                </button>
                            </div>

                            {orderTicket === 'quick' ? (
                                <div className="kite-quick-grid">
                                    <div style={{ minWidth: '140px' }}>
                                        <label className="text-secondary text-sm">Qty.</label>
                                        <input
                                            className="input"
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={orderQuantity}
                                            onChange={(e) => setOrderQuantity(e.target.value)}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="text-secondary text-sm">Price</label>
                                        <div className="kite-quick-price">
                                            <strong>{Number.isFinite(livePrice) ? formatAmount(livePrice) : '--'}</strong>
                                            <button type="button" className="kite-clear" onClick={() => setOrderPrice('')} title="Clear">
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                    <label className="text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={orderIntent === 'intraday'}
                                            onChange={(e) => setOrderIntent(e.target.checked ? 'intraday' : 'delivery')}
                                        />
                                        Intraday
                                    </label>
                                </div>
                            ) : (
                                <div className="kite-ticket-grid">
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
                                {orderTicket === 'regular' && (
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
                                )}
                                <div style={{ minWidth: '260px' }}>
                                    <label className="text-secondary text-sm">Product</label>
                                    <div className="flex gap-4 items-center" style={{ paddingTop: '0.35rem' }}>
                                        <label className="text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="orderProduct"
                                                value="intraday"
                                                checked={orderIntent === 'intraday'}
                                                onChange={(e) => setOrderIntent(e.target.value)}
                                            />
                                            Intraday <span className="text-secondary text-xs">MIS</span>
                                        </label>
                                        <label className="text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="orderProduct"
                                                value="delivery"
                                                checked={orderIntent === 'delivery'}
                                                onChange={(e) => setOrderIntent(e.target.value)}
                                            />
                                            Longterm <span className="text-secondary text-xs">CNC</span>
                                        </label>
                                    </div>
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
                                <div style={{ minWidth: '160px', opacity: orderType === 'MARKET' ? 0.6 : 1 }}>
                                    <label className="text-secondary text-sm">Trigger price</label>
                                    <input className="input" type="text" value="" placeholder="Not set" readOnly />
                                </div>
                            </div>
                            )}

                            {orderTicket !== 'quick' && orderAdvanced && (
                                <div className="kite-advanced-panel">
                                    <div className="kite-advanced-row">
                                        <div className="kite-advanced-block">
                                            <div className="text-secondary text-sm">Stoploss</div>
                                            <div className="flex gap-3 items-center" style={{ marginTop: 6 }}>
                                                <label className="text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={orderStopEnabled}
                                                        onChange={(e) => setOrderStopEnabled(e.target.checked)}
                                                    />
                                                    Enable
                                                </label>
                                                <label className="text-sm flex items-center gap-2" style={{ cursor: 'pointer', opacity: orderStopEnabled ? 1 : 0.6 }}>
                                                    <input
                                                        type="radio"
                                                        name="slType"
                                                        value="SL"
                                                        disabled={!orderStopEnabled}
                                                        checked={orderStopType === 'SL'}
                                                        onChange={(e) => setOrderStopType(e.target.value)}
                                                    />
                                                    SL
                                                </label>
                                                <label className="text-sm flex items-center gap-2" style={{ cursor: 'pointer', opacity: orderStopEnabled ? 1 : 0.6 }}>
                                                    <input
                                                        type="radio"
                                                        name="slType"
                                                        value="SL-M"
                                                        disabled={!orderStopEnabled}
                                                        checked={orderStopType === 'SL-M'}
                                                        onChange={(e) => setOrderStopType(e.target.value)}
                                                    />
                                                    SL-M
                                                </label>
                                            </div>
                                        </div>
                                        <div className="kite-advanced-block" style={{ minWidth: 160 }}>
                                            <label className="text-secondary text-sm">Stoploss (%)</label>
                                            <input
                                                className="input"
                                                type="number"
                                                step="0.1"
                                                value={orderStopPercent}
                                                disabled={!orderStopEnabled}
                                                onChange={(e) => setOrderStopPercent(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="kite-advanced-block">
                                            <div className="text-secondary text-sm">Target</div>
                                            <div className="flex gap-3 items-center" style={{ marginTop: 6 }}>
                                                <label className="text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={orderTargetEnabled}
                                                        onChange={(e) => setOrderTargetEnabled(e.target.checked)}
                                                    />
                                                    Enable
                                                </label>
                                            </div>
                                        </div>
                                        <div className="kite-advanced-block" style={{ minWidth: 160 }}>
                                            <label className="text-secondary text-sm">Target (%)</label>
                                            <input
                                                className="input"
                                                type="number"
                                                step="0.1"
                                                value={orderTargetPercent}
                                                disabled={!orderTargetEnabled}
                                                onChange={(e) => setOrderTargetPercent(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="kite-advanced-block" style={{ minWidth: 180 }}>
                                            <label className="text-secondary text-sm">Account Risk (₹)</label>
                                            <input
                                                className="input"
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={orderAccountRisk}
                                                onChange={(e) => setOrderAccountRisk(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="kite-advanced-block" style={{ minWidth: 200 }}>
                                            <div className="text-secondary text-sm">MIS Target Mode</div>
                                            <label className="text-sm flex items-center gap-2" style={{ cursor: 'pointer', marginTop: 6 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={orderCloseTargetForMis}
                                                    onChange={(e) => setOrderCloseTargetForMis(e.target.checked)}
                                                    disabled={orderIntent !== 'intraday' || !orderTargetEnabled}
                                                />
                                                Close target (no limit)
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="text-secondary text-sm" style={{ marginTop: '0.5rem' }}>
                                Live Price: {livePrice !== null ? formatAmount(livePrice) : '--'}
                            </div>
                            <div className={`kite-reco-inline kite-reco-${orderRecommendation.tone}`}>
                                <span className="kite-reco-label">Recommendation: {orderRecommendation.label}</span>
                                {orderRecommendation.metrics ? (
                                    <span className="kite-reco-detail">
                                        {' '}
                                        — SMA20 {Number(orderRecommendation.metrics.sma20).toFixed(2)} / SMA50 {Number(orderRecommendation.metrics.sma50).toFixed(2)} · RSI {Number(orderRecommendation.metrics.rsi14).toFixed(1)} · MACD {Number(orderRecommendation.metrics.macd).toFixed(3)}/{Number(orderRecommendation.metrics.signal).toFixed(3)} · {orderRecommendation.metrics.pattern}
                                    </span>
                                ) : orderRecommendation.detail ? (
                                    <span className="kite-reco-detail">— {orderRecommendation.detail}</span>
                                ) : null}
                            </div>
                            <div className="kite-funds-row">
                                <div className="kite-funds">
                                    <span className="text-secondary text-sm">Required</span>{' '}
                                    <strong>
                                        ₹{formatAmount(orderEstimate?.total)}{' '}
                                        <span className="text-secondary" style={{ fontWeight: 500 }}>
                                            + {formatAmount(orderEstimate?.charges?.total)}
                                        </span>
                                    </strong>
                                </div>
                                <div className="kite-funds">
                                    <span className="text-secondary text-sm">Available</span>{' '}
                                    <strong>
                                        ₹{formatAmount(marginSummary?.equity?.available?.cash ?? marginSummary?.available_cash)}
                                    </strong>
                                </div>
                                {marginSummaryError ? <span className="text-danger text-xs">{marginSummaryError}</span> : null}
                                {orderEstimateError ? <span className="text-danger text-xs">{orderEstimateError}</span> : null}
                            </div>
                            {orderModalError && <p className="text-danger text-sm">{orderModalError}</p>}
                        </div>
                        <div className="flex gap-2 justify-end kite-order-footer">
                            <button type="button" className="btn btn-outline" onClick={closeOrderModal}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={submitOrder}
                                disabled={orderSubmittingId !== null || !orderPayload || (orderType === 'LIMIT' && !orderPrice)}
                            >
                                {orderSubmittingAction === orderModal.action ? 'Placing...' : 'Buy'}
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
                            <div className="flex flex-wrap gap-2 scale-buttons modal-scale-controls">
                                {scales.map(scale => (
                                    <button
                                        key={scale}
                                        className={`btn btn-sm ${selectedScale === scale ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setSelectedScale(scale)}
                                    >
                                        {typeof scale === 'string' && scale.endsWith('d') ? scale.toUpperCase() : scale}
                                    </button>
                                ))}
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
            {connectModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content card connect-modal" style={{ width: 'min(560px, 92vw)' }}>
                        <div className="modal-header">
                            <div>
                                <h2>Connect Zerodha</h2>
                                <p className="modal-subtitle">
                                    {connectStatus === 'loading' && 'Connecting with Zerodha'}
                                    {connectStatus === 'error' && 'Connection failed'}
                                </p>
                            </div>
                            <button className="btn-icon" onClick={closeConnectModal} aria-label="Close">
                                <X size={22} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {connectStatus === 'loading' && (
                                <div className="connect-state">
                                    <div className="connect-spinner" />
                                    <p className="text-secondary text-sm">Please wait while we reach Zerodha.</p>
                                </div>
                            )}
                            {connectStatus === 'error' && (
                                <div className="connect-state">
                                    <p className="text-danger text-sm">{connectError || 'Unable to connect.'}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 justify-end">
                            {connectStatus === 'error' && (
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => handleConnectZerodha(activeTab)}
                                >
                                    Retry
                                </button>
                            )}
                            <button type="button" className="btn btn-outline" onClick={closeConnectModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default EnhancedDashboard;
