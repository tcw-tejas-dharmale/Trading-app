import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    zoomPlugin
);

const ZoomableLineChart = ({ 
    data, 
    label = 'Price',
    showMA20 = false,
    showMA50 = false,
    onDataUpdate,
    updateInterval = 5000 // milliseconds
}) => {
    const chartRef = useRef(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [currentData, setCurrentData] = useState(data || []);

    // Update data when prop changes
    useEffect(() => {
        if (data) {
            setCurrentData(data);
        }
    }, [data]);

    // Real-time data updates via polling (if onDataUpdate is provided)
    useEffect(() => {
        if (!onDataUpdate || !updateInterval) return;

        const intervalId = setInterval(async () => {
            try {
                const newData = await onDataUpdate();
                if (newData && Array.isArray(newData)) {
                    setCurrentData(prevData => {
                        // Merge new data with existing, avoiding duplicates
                        const merged = [...prevData];
                        newData.forEach(newPoint => {
                            const existingIndex = merged.findIndex(
                                p => new Date(p.date).getTime() === new Date(newPoint.date).getTime()
                            );
                            if (existingIndex >= 0) {
                                merged[existingIndex] = newPoint;
                            } else {
                                merged.push(newPoint);
                            }
                        });
                        // Sort by date
                        return merged.sort((a, b) => new Date(a.date) - new Date(b.date));
                    });
                }
            } catch (error) {
                console.error('Error updating chart data:', error);
            }
        }, updateInterval);

        return () => clearInterval(intervalId);
    }, [onDataUpdate, updateInterval]);

    // Calculate moving averages
    const calculateMA = useCallback((period) => {
        if (!currentData || currentData.length === 0) return [];
        const ma = [];
        for (let i = 0; i < currentData.length; i++) {
            if (i < period - 1) {
                ma.push(null);
            } else {
                const sum = currentData.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
                ma.push(sum / period);
            }
        }
        return ma;
    }, [currentData]);

    const ma20 = calculateMA(20);
    const ma50 = calculateMA(50);

    // Prepare labels with dates
    const labels = currentData.map(d => new Date(d.date));

    // Prepare datasets
    const datasets = [
        {
            label: label,
            data: currentData.map(d => d.close),
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            borderWidth: 2,
            tension: 0.1,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 2,
        },
        ...(showMA20 && ma20.some(v => v !== null) ? [{
            label: 'MA 20',
            data: ma20,
            borderColor: '#fbbf24',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 2,
            order: 1,
        }] : []),
        ...(showMA50 && ma50.some(v => v !== null) ? [{
            label: 'MA 50',
            data: ma50,
            borderColor: '#8b5cf6',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 2,
            order: 0,
        }] : []),
    ];

    const chartData = {
        labels: labels.map((d) => {
            const date = new Date(d);
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }),
        datasets,
    };

    const updateLineYAxis = useCallback((chart) => {
        const xScale = chart?.scales?.x;
        const yScale = chart?.scales?.y;
        if (!xScale || !yScale) return;

        const minIndex = Number.isFinite(xScale.min) ? Math.max(0, Math.floor(xScale.min)) : 0;
        const maxIndex = Number.isFinite(xScale.max)
            ? Math.min(labels.length - 1, Math.ceil(xScale.max))
            : labels.length - 1;

        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        chart.data.datasets.forEach((dataset) => {
            if (!Array.isArray(dataset.data)) return;
            for (let i = minIndex; i <= maxIndex; i += 1) {
                const value = dataset.data[i];
                if (value === null || value === undefined) continue;
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        });

        if (!Number.isFinite(min) || !Number.isFinite(max)) return;
        const padding = (max - min) * 0.05 || 1;
        chart.options.scales.y.min = min - padding;
        chart.options.scales.y.max = max + padding;
    }, [labels.length]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        animation: {
            duration: 0, // Disable animation for real-time updates
        },
        plugins: {
            legend: {
                display: false,
                position: 'top',
                labels: {
                    color: '#94a3b8',
                    usePointStyle: true,
                    padding: 15,
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#94a3b8',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                    title: (context) => {
                        const date = new Date(labels[context[0].dataIndex]);
                        return date.toLocaleString([], { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                    },
                    label: (context) => {
                        const chart = context.chart;
                        const yScale = chart?.scales?.y;
                        let precision = 2;
                        
                        if (yScale) {
                            const range = yScale.max - yScale.min;
                            if (range < 0.1) precision = 4;
                            else if (range < 1) precision = 3;
                            else if (range < 10) precision = 2;
                            else precision = 1;
                        }
                        
                        return `${context.dataset.label}: ${context.parsed.y.toFixed(precision)}`;
                    }
                }
            },
            zoom: {
                zoom: {
                    wheel: {
                        enabled: true,
                        speed: 0.1,
                    },
                    pinch: {
                        enabled: true,
                    },
                    mode: 'x',
                    onZoomComplete: ({ chart }) => {
                        setIsZoomed(true);
                        updateLineYAxis(chart);
                        chart.update('none');
                    }
                },
                pan: {
                    enabled: true,
                    mode: 'x',
                    onPanComplete: ({ chart }) => {
                        setIsZoomed(true);
                        updateLineYAxis(chart);
                        chart.update('none');
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'category',
                grid: {
                    color: '#334155',
                    display: false
                },
                ticks: {
                    color: '#94a3b8',
                    maxTicksLimit: 15,
                    maxRotation: 45,
                    minRotation: 0,
                    font: {
                        size: 11
                    },
                    callback: function(value, index, ticks) {
                        const chart = this.chart;
                        const scale = chart?.scales?.x;
                        if (!scale) return '';
                        
                        const date = new Date(labels[index]);
                        const visibleRange = scale.max - scale.min;
                        const totalRange = labels.length;
                        const zoomRatio = visibleRange / totalRange;
                        
                        if (zoomRatio < 0.01) {
                            // Very zoomed in - show minutes
                            return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        } else if (zoomRatio < 0.1) {
                            // Zoomed in - show hours
                            return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
                        } else if (zoomRatio < 0.5) {
                            // Medium zoom - show days
                            return date.toLocaleString([], { month: 'short', day: 'numeric' });
                        } else {
                            // Normal view - show dates
                            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        }
                    }
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                grid: {
                    color: '#334155',
                },
                ticks: {
                    color: '#94a3b8',
                    font: {
                        size: 11
                    },
                    callback: function(value) {
                        const chart = this.chart;
                        const scale = chart?.scales?.y;
                        if (!scale) return value.toFixed(2);
                        
                        const range = scale.max - scale.min;
                        let precision = 2;
                        
                        if (range < 0.1) precision = 4;
                        else if (range < 1) precision = 3;
                        else if (range < 10) precision = 2;
                        else precision = 1;
                        
                        return value.toFixed(precision);
                    }
                },
                title: {
                    display: true,
                    text: 'Price',
                    color: '#94a3b8',
                    font: {
                        size: 12
                    }
                }
            }
        },
        onHover: (event, activeElements) => {
            if (activeElements && activeElements.length > 0) {
                event.native.target.style.cursor = 'crosshair';
            } else {
                event.native.target.style.cursor = 'default';
            }
        }
    };

    // Reset zoom handler
    const handleResetZoom = () => {
        if (chartRef.current && chartRef.current.resetZoom) {
            chartRef.current.resetZoom();
            setIsZoomed(false);
            updateLineYAxis(chartRef.current);
        }
    };

    useEffect(() => {
        if (!chartRef.current) return;
        updateLineYAxis(chartRef.current);
        chartRef.current.update('none');
    }, [currentData, updateLineYAxis]);

    if (!currentData || currentData.length === 0) {
        return <div className="p-4 text-center text-secondary">No data available</div>;
    }

    return (
        <div className="zoomable-line-chart-wrapper" style={{ position: 'relative' }}>
            {isZoomed && (
                <button
                    onClick={handleResetZoom}
                    className="btn btn-outline btn-sm"
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 10,
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem'
                    }}
                >
                    Reset Zoom
                </button>
            )}
            <Line 
                ref={chartRef}
                data={chartData} 
                options={options}
                updateMode="none" // Prevent animation on updates
            />
        </div>
    );
};

export default ZoomableLineChart;
