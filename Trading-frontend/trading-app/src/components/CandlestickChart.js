import React, { useEffect, useMemo, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { createChart, CrosshairMode, LineStyle, CandlestickSeries, LineSeries } from 'lightweight-charts';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    zoomPlugin
);

const CandlestickChart = ({ data, label, showVolume = false, showMovingAverage = true, chartMode = 'candlestick', scale = '5m' }) => {
    const chartContainerRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const candleSeriesRef = useRef(null);
    const ma20SeriesRef = useRef(null);
    const ma50SeriesRef = useRef(null);
    const priceLinesRef = useRef([]);
    const userInteractedRef = useRef(false);
    const suppressInteractionRef = useRef(false);
    const pendingFitRef = useRef(false);
    const lastScaleRef = useRef(scale);
    const tooltipRef = useRef(null);
    const safeData = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return [...data]
            .filter((entry) => entry && entry.date)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    // Calculate moving averages
    const calculateMA = (period) => {
        const ma = [];
        for (let i = 0; i < safeData.length; i++) {
            if (i < period - 1) {
                ma.push(null);
            } else {
                const sum = safeData.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
                ma.push(sum / period);
            }
        }
        return ma;
    };

    const ma20 = calculateMA(20);
    const ma50 = calculateMA(50);

    // Prepare candlestick data
    const candleData = safeData.map(d => ({
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        isBullish: d.close >= d.open
    }));

    const latestCandle = candleData[candleData.length - 1];
    const tradeMarkers = latestCandle ? [
        {
            label: 'Open Trade',
            value: latestCandle.close,
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.18)'
        },
        {
            label: 'Stop Loss',
            value: latestCandle.close * 0.985,
            color: '#f97316',
            bg: 'rgba(249, 115, 22, 0.18)'
        },
        {
            label: 'Take Profit',
            value: latestCandle.close * 1.015,
            color: '#22c55e',
            bg: 'rgba(34, 197, 94, 0.18)'
        }
    ] : [];
    const formatPrice = (value) => (Number.isFinite(value) ? value.toFixed(2) : '--');

    // Prepare data for chart
    const isDayOrAbove = ['1d', '2d', '1M'].includes(scale);
    const labels = safeData.map(d => new Date(d.date).toLocaleString([],
        isDayOrAbove
            ? { month: 'short', day: 'numeric' } // Date only for larger scales
            : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } // Date + Time for intraday
    ));

    // Prepare volume and color data early for potential volume chart use
    const volumeData = safeData.map(d => d.volume);
    const volumeColors = candleData.map(c => c.isBullish ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)');
    const candleSeriesData = useMemo(() => (
        safeData.map((d) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }))
    ), [safeData]);

    const ma20SeriesData = useMemo(() => (
        safeData.map((d, index) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000),
            value: ma20[index],
        })).filter((point) => Number.isFinite(point.value))
    ), [ma20, safeData]);

    const ma50SeriesData = useMemo(() => (
        safeData.map((d, index) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000),
            value: ma50[index],
        })).filter((point) => Number.isFinite(point.value))
    ), [ma50, safeData]);

    useEffect(() => {
        if (lastScaleRef.current !== scale) {
            lastScaleRef.current = scale;
            userInteractedRef.current = false;
            pendingFitRef.current = true;
        }
    }, [scale]);

    useEffect(() => {
        if (chartMode !== 'candlestick' || safeData.length === 0) {
            return undefined;
        }

        const container = chartContainerRef.current;
        if (!container) {
            return undefined;
        }

        if (chartInstanceRef.current) {
            chartInstanceRef.current.remove();
            chartInstanceRef.current = null;
            candleSeriesRef.current = null;
            ma20SeriesRef.current = null;
            ma50SeriesRef.current = null;
        }

        userInteractedRef.current = false;

        const chart = createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: {
                background: { color: '#0b1220' },
                textColor: '#94a3b8',
                fontFamily: '"Space Grotesk", sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(148, 163, 184, 0.12)' },
                horzLines: { color: 'rgba(148, 163, 184, 0.12)' },
            },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: {
                borderColor: 'rgba(148, 163, 184, 0.2)',
            },
            timeScale: {
                borderColor: 'rgba(148, 163, 184, 0.2)',
                rightOffset: 6,
                barSpacing: 6,
                minBarSpacing: 3,
                lockVisibleTimeRangeOnResize: true,
                timeVisible: !isDayOrAbove,
                secondsVisible: false,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
                axisPressedMouseMove: true,
            },
        });

        chartInstanceRef.current = chart;
        candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        const handleRangeChange = () => {
            if (suppressInteractionRef.current) return;
            userInteractedRef.current = true;
        };
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

        const resizeObserver = new ResizeObserver(() => {
            if (!chartContainerRef.current) return;
            chart.applyOptions({
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
            });
        });
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
            chart.remove();
            chartInstanceRef.current = null;
            candleSeriesRef.current = null;
            ma20SeriesRef.current = null;
            ma50SeriesRef.current = null;
        };
    }, [chartMode, isDayOrAbove, safeData.length]);

    useEffect(() => {
        if (chartMode !== 'candlestick' || safeData.length === 0) {
            return;
        }
        const chart = chartInstanceRef.current;
        const series = candleSeriesRef.current;
        if (!chart || !series) {
            return;
        }

        series.setData(candleSeriesData);

        priceLinesRef.current.forEach((line) => series.removePriceLine(line));
        priceLinesRef.current = tradeMarkers.map((marker) => (
            series.createPriceLine({
                price: marker.value,
                color: marker.color,
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: `${marker.label} ${formatPrice(marker.value)}`,
            })
        ));

        const shouldShowMa20 = showMovingAverage && ma20SeriesData.length > 0;
        const shouldShowMa50 = showMovingAverage && ma50SeriesData.length > 0;

        if (shouldShowMa20) {
            if (!ma20SeriesRef.current) {
                ma20SeriesRef.current = chart.addSeries(LineSeries, {
                    color: '#fbbf24',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                });
            }
            ma20SeriesRef.current.setData(ma20SeriesData);
        } else if (ma20SeriesRef.current) {
            chart.removeSeries(ma20SeriesRef.current);
            ma20SeriesRef.current = null;
        }

        if (shouldShowMa50) {
            if (!ma50SeriesRef.current) {
                ma50SeriesRef.current = chart.addSeries(LineSeries, {
                    color: '#8b5cf6',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                });
            }
            ma50SeriesRef.current.setData(ma50SeriesData);
        } else if (ma50SeriesRef.current) {
            chart.removeSeries(ma50SeriesRef.current);
            ma50SeriesRef.current = null;
        }

        if (pendingFitRef.current || !userInteractedRef.current) {
            suppressInteractionRef.current = true;
            chart.timeScale().fitContent();
            suppressInteractionRef.current = false;
            pendingFitRef.current = false;
        }
    }, [chartMode, candleSeriesData, tradeMarkers, formatPrice, showMovingAverage, ma20SeriesData, ma50SeriesData, safeData.length]);

    useEffect(() => {
        if (chartMode !== 'candlestick' || safeData.length === 0) {
            return undefined;
        }
        const chart = chartInstanceRef.current;
        const series = candleSeriesRef.current;
        const tooltip = tooltipRef.current;
        const container = chartContainerRef.current;
        if (!chart || !series || !tooltip || !container) {
            return undefined;
        }

        const formatTime = (timestamp) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleString([], isDayOrAbove
                ? { month: 'short', day: 'numeric' }
                : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
            );
        };

        const handleCrosshairMove = (param) => {
            if (!param?.time || !param?.point) {
                tooltip.style.display = 'none';
                return;
            }
            const price = param.seriesData.get(series);
            if (!price) {
                tooltip.style.display = 'none';
                return;
            }
            const { open, high, low, close } = price;
            tooltip.innerHTML = `
                <div class="candlestick-tooltip-title">${formatTime(param.time)}</div>
                <div>Open: ${formatPrice(open)}</div>
                <div>High: ${formatPrice(high)}</div>
                <div>Low: ${formatPrice(low)}</div>
                <div>Close: ${formatPrice(close)}</div>
                <div>Change: ${((close - open) / open * 100).toFixed(2)}%</div>
            `;
            tooltip.style.display = 'block';

            const margin = 12;
            const { x, y } = param.point;
            const tooltipWidth = tooltip.offsetWidth || 120;
            const tooltipHeight = tooltip.offsetHeight || 80;
            const left = Math.min(
                Math.max(x + margin, margin),
                container.clientWidth - tooltipWidth - margin
            );
            const top = Math.min(
                Math.max(y + margin, margin),
                container.clientHeight - tooltipHeight - margin
            );

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        chart.subscribeCrosshairMove(handleCrosshairMove);
        return () => chart.unsubscribeCrosshairMove(handleCrosshairMove);
    }, [chartMode, formatPrice, isDayOrAbove, safeData.length]);

    // If chart mode is volume, only show volume bars
    if (safeData.length === 0) {
        return <div className="p-4 text-center text-secondary">No data available</div>;
    }

    if (chartMode === 'volume') {
        return (
            <div className="candlestick-chart-wrapper">
                <Bar
                    data={{
                        labels,
                        datasets: [{
                            label: 'Volume',
                            data: volumeData,
                            backgroundColor: volumeColors,
                            maxBarThickness: 30,
                        }]
                    }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                titleColor: '#f8fafc',
                                bodyColor: '#94a3b8',
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { color: '#94a3b8', maxTicksLimit: 15 }
                            },
                            y: {
                                position: 'left',
                                grid: { color: '#334155' },
                                ticks: {
                                    color: '#64748b',
                                    callback: (value) => {
                                        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                        if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
                                        return value;
                                    }
                                },
                                title: {
                                    display: true,
                                    text: 'Volume',
                                    color: '#94a3b8'
                                }
                            }
                        }
                    }}
                />
            </div>
        );
    }

    // For line chart mode
    if (chartMode === 'line') {
        const datasets = [
            {
                type: 'line',
                label: 'Close Price',
                data: safeData.map(d => d.close),
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderWidth: 2,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4,
                order: 0,
            },
            ...(showMovingAverage && ma20.some(v => v !== null) ? [{
                type: 'line',
                label: 'MA 20',
                data: ma20,
                borderColor: '#fbbf24',
                borderWidth: 1.5,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 3,
                order: 1,
            }] : []),
            ...(showMovingAverage && ma50.some(v => v !== null) ? [{
                type: 'line',
                label: 'MA 50',
                data: ma50,
                borderColor: '#8b5cf6',
                borderWidth: 1.5,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 3,
                order: 1,
            }] : []),
        ];

        return (
            <div className="candlestick-chart-wrapper">
                <Line
                    data={{ labels, datasets }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: { color: '#94a3b8', usePointStyle: true, padding: 15 }
                            },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                titleColor: '#f8fafc',
                                bodyColor: '#94a3b8',
                                borderColor: '#334155',
                                borderWidth: 1,
                                padding: 12,
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: '#334155', display: false },
                                ticks: { color: '#94a3b8', maxTicksLimit: 15, maxRotation: 45, minRotation: 0 }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                grid: { color: '#334155' },
                                ticks: { color: '#94a3b8', callback: (value) => value.toFixed(2) },
                                title: { display: true, text: 'Price', color: '#94a3b8' }
                            }
                        }
                    }}
                />
            </div>
        );
    }

    return (
        <div className="candlestick-chart-wrapper">
            <div ref={chartContainerRef} className="candlestick-chart-canvas" />
            <div ref={tooltipRef} className="candlestick-tooltip" style={{ display: 'none' }} />
        </div>
    );
};

export default CandlestickChart;
