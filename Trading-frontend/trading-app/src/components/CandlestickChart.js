import React, { useCallback, useEffect, useRef } from 'react';
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

const CandlestickChart = ({ data, label, showVolume = false, showMovingAverage = true, chartMode = 'candlestick' }) => {
    const chartRef = useRef(null);
    const safeData = Array.isArray(data) ? data : [];

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

    // Prepare data for chart
    const labels = safeData.map(d => new Date(d.date).toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    }));

    // Volume data
    const volumeData = safeData.map(d => d.volume);
    const volumeColors = candleData.map(c => c.isBullish ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)');

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
                data: data.map(d => d.close),
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

    // For candlestick mode - Create custom plugin to draw candlesticks
    const candlestickPlugin = {
        id: 'candlestick',
        afterDatasetsDraw: (chart) => {
            const ctx = chart.ctx;
            const yScale = chart.scales.y;
            const xScale = chart.scales.x;
            
            const minIndex = Number.isFinite(xScale.min) ? Math.max(0, Math.floor(xScale.min)) : 0;
            const maxIndex = Number.isFinite(xScale.max)
                ? Math.min(candleData.length - 1, Math.ceil(xScale.max))
                : candleData.length - 1;
            const visibleCount = Math.max(1, maxIndex - minIndex + 1);
            const candleWidth = Math.max(4, (xScale.width / visibleCount) * 0.6);

            ctx.save();
            ctx.beginPath();
            ctx.rect(chart.chartArea.left, chart.chartArea.top, chart.chartArea.width, chart.chartArea.height);
            ctx.clip();
            candleData.forEach((candle, index) => {
                const x = xScale.getPixelForValue(index);
                const highY = yScale.getPixelForValue(candle.high);
                const lowY = yScale.getPixelForValue(candle.low);
                const openY = yScale.getPixelForValue(candle.open);
                const closeY = yScale.getPixelForValue(candle.close);
                
                const bodyTop = Math.min(openY, closeY);
                const bodyBottom = Math.max(openY, closeY);
                const bodyHeight = bodyBottom - bodyTop;
                const bodyWidth = candleWidth;
                
                const color = candle.isBullish ? '#22c55e' : '#ef4444';
                
                // Draw wick (high-low line)
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, highY);
                ctx.lineTo(x, lowY);
                ctx.stroke();
                
                // Draw body rectangle
                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight || 1);
                ctx.strokeRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight || 1);
            });
            ctx.restore();
        }
    };

    const updateCandlestickYAxis = useCallback((chart) => {
        const xScale = chart?.scales?.x;
        const yScale = chart?.scales?.y;
        if (!xScale || !yScale || candleData.length === 0) return;

        const minIndex = Number.isFinite(xScale.min) ? Math.max(0, Math.floor(xScale.min)) : 0;
        const maxIndex = Number.isFinite(xScale.max)
            ? Math.min(candleData.length - 1, Math.ceil(xScale.max))
            : candleData.length - 1;

        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (let i = minIndex; i <= maxIndex; i += 1) {
            const candle = candleData[i];
            if (!candle) continue;
            min = Math.min(min, candle.low);
            max = Math.max(max, candle.high);
        }

        if (!Number.isFinite(min) || !Number.isFinite(max)) return;
        const padding = (max - min) * 0.05 || 1;
        chart.options.scales.y.min = min - padding;
        chart.options.scales.y.max = max + padding;
    }, [candleData]);

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = chartRef.current;
        updateCandlestickYAxis(chart);
        chart.update('none');
    }, [updateCandlestickYAxis]);

    // Create datasets for candlestick (moving averages only, candlesticks drawn by plugin)
    const candlestickDatasets = [
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
            order: 0,
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
            order: 0,
        }] : []),
        // Hidden dataset to establish scale
        {
            type: 'line',
            label: 'Price',
            data: data.map(d => d.close),
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            pointHoverRadius: 0,
            order: 1,
        }
    ];

    return (
        <div className="candlestick-chart-wrapper">
            <Line 
                data={{ labels, datasets: candlestickDatasets }} 
                plugins={[candlestickPlugin]}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: false,
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
                            callbacks: {
                                title: (context) => labels[context[0].dataIndex],
                                label: function(context) {
                                    const dataIndex = context.dataIndex;
                                    const candle = candleData[dataIndex];
                                    const datasetLabel = context.dataset.label || '';
                                    
                                    // For hidden Price dataset, show candlestick data
                                    if (datasetLabel === 'Price') {
                                        return [
                                            `Open: ${candle.open.toFixed(2)}`,
                                            `High: ${candle.high.toFixed(2)}`,
                                            `Low: ${candle.low.toFixed(2)}`,
                                            `Close: ${candle.close.toFixed(2)}`,
                                            `Change: ${((candle.close - candle.open) / candle.open * 100).toFixed(2)}%`
                                        ];
                                    }
                                    // For moving averages
                                    return `${datasetLabel}: ${context.parsed.y?.toFixed(2) || 'N/A'}`;
                                },
                                filter: (item) => {
                                    // Hide the transparent Price dataset from tooltip, we'll show candlestick data instead
                                    if (item.dataset.label === 'Price') {
                                        return true; // Keep it to show candlestick info
                                    }
                                    return true;
                                }
                            }
                        },
                        zoom: {
                            zoom: {
                                wheel: { enabled: true, speed: 0.1 },
                                pinch: { enabled: true },
                                mode: 'x',
                                onZoomComplete: ({ chart }) => {
                                    updateCandlestickYAxis(chart);
                                    chart.update('none');
                                }
                            },
                            pan: {
                                enabled: true,
                                mode: 'x',
                                onPanComplete: ({ chart }) => {
                                    updateCandlestickYAxis(chart);
                                    chart.update('none');
                                }
                            }
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
                            title: { display: true, text: 'Price', color: '#94a3b8' },
                            suggestedMin: Math.min(...candleData.map(c => c.low)) * 0.98,
                            suggestedMax: Math.max(...candleData.map(c => c.high)) * 1.02
                        }
                    }
                }} 
                ref={chartRef}
            />
        </div>
    );
};

export default CandlestickChart;
