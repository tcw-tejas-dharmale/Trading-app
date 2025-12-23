import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const ChartComponent = ({ data, label }) => {
    if (!data || data.length === 0) return <div className="p-4 text-center text-secondary">No data available</div>;

    const chartData = {
        labels: data.map(d => new Date(d.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        datasets: [
            {
                label: label || 'Price',
                data: data.map(d => d.close),
                borderColor: '#38bdf8', // accent color
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                tension: 0.1,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#94a3b8',
                borderColor: '#334155',
                borderWidth: 1,
            }
        },
        scales: {
            x: {
                grid: {
                    color: '#334155',
                    display: false
                },
                ticks: {
                    color: '#94a3b8',
                    maxTicksLimit: 10
                }
            },
            y: {
                grid: {
                    color: '#334155',
                },
                ticks: {
                    color: '#94a3b8'
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };

    return <Line data={chartData} options={options} />;
};

export default ChartComponent;
