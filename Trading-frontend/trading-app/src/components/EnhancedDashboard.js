import React, { useState, useEffect } from 'react';
import { fetchScales, fetchStrategies, fetchHistoricalData, fetchFinancialHistory, fetchCompetitors, fetchROIProjection, fetchRiskAssessment } from '../services/api';
import CandlestickChart from './CandlestickChart';
import ZoomableLineChart from './ZoomableLineChart';
import { Clock, Sliders, TrendingUp, TrendingDown, Info, Shield, Target, AlertCircle, CheckCircle2, Star, Search } from 'lucide-react';
import './EnhancedDashboard.css';

const EnhancedDashboard = ({ selectedInstrument }) => {
    const [scales, setScales] = useState([]);
    const [strategies, setStrategies] = useState([]);
    const [selectedScale, setSelectedScale] = useState('5m');
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [marketData, setMarketData] = useState([]);
    const [financialHistory, setFinancialHistory] = useState([]);
    const [competitors, setCompetitors] = useState([]);
    const [roiProjection, setRoiProjection] = useState(null);
    const [riskAssessment, setRiskAssessment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [chartType, setChartType] = useState('candlestick'); // 'candlestick', 'line', or 'bar'
    const [tooltipData, setTooltipData] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);
    const preferredScales = ['1m', '5m', '2d', '4d'];

    const loadOptions = async () => {
        try {
            const [scalesData, strategiesData] = await Promise.all([
                fetchScales(),
                fetchStrategies()
            ]);
            const mergedScales = [...preferredScales];
            scalesData.forEach((scale) => {
                if (!mergedScales.includes(scale)) {
                    mergedScales.push(scale);
                }
            });
            setScales(mergedScales);
            setStrategies(strategiesData);
            if (mergedScales.length > 0) setSelectedScale(mergedScales[1] || mergedScales[0]);
            if (strategiesData.length > 0) setSelectedStrategy(strategiesData[0].id);
        } catch (error) {
            console.error("Failed to load dashboard options", error);
        }
    };

    const loadFinancialData = async () => {
        try {
            const [history, comps, roi, risk] = await Promise.all([
                fetchFinancialHistory(5),
                fetchCompetitors(),
                fetchROIProjection(10000, 5),
                fetchRiskAssessment()
            ]);
            setFinancialHistory(history);
            setCompetitors(comps);
            setRoiProjection(roi);
            setRiskAssessment(risk);
        } catch (error) {
            console.error("Failed to load financial data", error);
        }
    };

    const loadData = async () => {
        if (!selectedInstrument) return;
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

    useEffect(() => {
        loadOptions();
        loadFinancialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedInstrument && selectedScale) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedInstrument, selectedScale, selectedStrategy]);

    const handleScanStocks = () => {
        if (selectedInstrument && selectedScale) {
            loadData();
        }
    };

    const formatCurrency = (value) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
        return `$${value.toFixed(2)}`;
    };

    const formatScaleLabel = (scale) => {
        if (typeof scale !== 'string') return scale;
        return scale.endsWith('d') ? scale.toUpperCase() : scale;
    };

    return (
        <div className="enhanced-dashboard container">
            {/* Toolbar */}
            <div className="toolbar card">
                <div className="flex flex-wrap gap-6 items-center w-full">
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
                                    {formatScaleLabel(scale)}
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
                            onClick={handleScanStocks}
                            disabled={!selectedInstrument}
                        >
                            Run Scan
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Chart Section - Increased Width */}
            {selectedInstrument && (
                <div className="main-chart-section">
                    <div className="chart-container-enhanced card">
                        <div className="chart-header">
                            <h2 className="chart-title">{selectedInstrument?.name} - Performance Analysis</h2>
                            <div className="chart-actions">
                                <button
                                    className={`btn btn-sm ${chartType === 'candlestick' ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setChartType('candlestick')}
                                >
                                    Candlestick
                                </button>
                                <button
                                    className={`btn btn-sm ${chartType === 'line' ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setChartType('line')}
                                >
                                    Line
                                </button>
                                <button
                                    className={`btn btn-sm ${chartType === 'bar' ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setChartType('bar')}
                                >
                                    Volume
                                </button>
                            </div>
                        </div>
                        {loading ? (
                            <div className="loading-state">Loading data...</div>
                        ) : marketData.length > 0 ? (
                            <div className="chart-wrapper-enhanced">
                                {chartType === 'bar' ? (
                                    <CandlestickChart
                                        data={marketData}
                                        label={`${selectedInstrument?.name}`}
                                        showVolume={true}
                                        showMovingAverage={false}
                                        chartMode="volume"
                                    />
                                ) : chartType === 'line' ? (
                                    <ZoomableLineChart
                                        data={marketData}
                                        label={`${selectedInstrument?.name} - Close Price`}
                                        showMA20={false}
                                        showMA50={false}
                                    />
                                ) : (
                                    <CandlestickChart
                                        data={marketData}
                                        label={`${selectedInstrument?.name}`}
                                        showVolume={false}
                                        showMovingAverage={false}
                                        chartMode="candlestick"
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="loading-state">No data available</div>
                        )}
                    </div>
                </div>
            )}

            {/* Financial Data Tables Section */}
            <div className="data-tables-section">
                {/* Historical Financial Data Table */}
                {financialHistory.length > 0 && (
                    <div className="financial-table-container card">
                        <div className="table-header">
                            <h3 className="table-title">5-Year Financial History</h3>
                            <div className="info-icon-wrapper"
                                onMouseEnter={() => setTooltipData("Quarterly revenue, profit margins, and year-over-year growth rates over the past 5 years")}
                                onMouseLeave={() => setTooltipData(null)}>
                                <Info size={18} className="info-icon" />
                                {tooltipData && (
                                    <div className="tooltip">{tooltipData}</div>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="enhanced-table">
                                <thead>
                                    <tr>
                                        <th>Quarter</th>
                                        <th>Revenue</th>
                                        <th>Profit</th>
                                        <th>Profit Margin</th>
                                        <th>YoY Growth</th>
                                        <th>Year</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {financialHistory.map((row, idx) => (
                                        <tr
                                            key={idx}
                                            onMouseEnter={() => setHoveredRow(idx)}
                                            onMouseLeave={() => setHoveredRow(null)}
                                            className={hoveredRow === idx ? 'hovered' : ''}
                                        >
                                            <td>{row.quarter}</td>
                                            <td>{formatCurrency(row.revenue)}</td>
                                            <td>{formatCurrency(row.profit)}</td>
                                            <td>
                                                <span className={`margin-badge ${row.profit_margin > 15 ? 'positive' : 'neutral'}`}>
                                                    {row.profit_margin}%
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`growth-badge ${row.yoy_growth > 0 ? 'positive' : 'negative'}`}>
                                                    {row.yoy_growth > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                    {Math.abs(row.yoy_growth).toFixed(2)}%
                                                </span>
                                            </td>
                                            <td>{row.year}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Competitor Comparison Table */}
                {competitors.length > 0 && (
                    <div className="competitor-table-container card">
                        <h3 className="table-title">Competitor Comparison</h3>
                        <div className="overflow-x-auto">
                            <table className="enhanced-table">
                                <thead>
                                    <tr>
                                        <th>Competitor</th>
                                        <th>Market Share</th>
                                        <th>Pricing Tier</th>
                                        <th>User Rating</th>
                                        <th>Reviews</th>
                                        <th>Monthly Price</th>
                                        <th>Key Features</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {competitors.map((comp, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{comp.name}</strong></td>
                                            <td>{comp.market_share}%</td>
                                            <td>
                                                <span className="pricing-badge">{comp.pricing_tier}</span>
                                            </td>
                                            <td>
                                                <div className="rating-display">
                                                    <Star size={16} className="star-icon" fill="currentColor" />
                                                    {comp.user_rating}
                                                </div>
                                            </td>
                                            <td>{comp.review_count.toLocaleString()}</td>
                                            <td>{formatCurrency(comp.monthly_price)}</td>
                                            <td>
                                                <div className="features-list">
                                                    {comp.features.map((feature, fIdx) => (
                                                        <span key={fIdx} className="feature-tag">{feature}</span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ROI & Risk Assessment Section */}
            <div className="analysis-section">
                {roiProjection && (
                    <div className="roi-card card">
                        <div className="card-header">
                            <Target size={24} className="card-icon" />
                            <h3 className="card-title">ROI Projections</h3>
                        </div>
                        <div className="roi-content">
                            <div className="roi-summary">
                                <div className="roi-stat">
                                    <span className="stat-label">Initial Investment</span>
                                    <span className="stat-value">{formatCurrency(roiProjection.initial_investment)}</span>
                                </div>
                                <div className="roi-stat">
                                    <span className="stat-label">Projected Value (5Y)</span>
                                    <span className="stat-value positive">{formatCurrency(roiProjection.projected_final_value)}</span>
                                </div>
                                <div className="roi-stat">
                                    <span className="stat-label">Total ROI</span>
                                    <span className="stat-value positive">+{roiProjection.total_roi}%</span>
                                </div>
                                <div className="roi-stat">
                                    <span className="stat-label">Annual Growth</span>
                                    <span className="stat-value positive">+{roiProjection.annual_growth_rate}%</span>
                                </div>
                            </div>
                            <div className="roi-timeline">
                                <h4>Yearly Projections</h4>
                                <div className="timeline-items">
                                    {roiProjection.yearly_projections.map((proj, idx) => (
                                        <div key={idx} className="timeline-item">
                                            <div className="timeline-year">Year {proj.year}</div>
                                            <div className="timeline-value">{formatCurrency(proj.projected_value)}</div>
                                            <div className="timeline-roi">+{proj.roi_percentage}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {riskAssessment && (
                    <div className="risk-card card">
                        <div className="card-header">
                            <Shield size={24} className="card-icon" />
                            <h3 className="card-title">Risk Assessment</h3>
                        </div>
                        <div className="risk-content">
                            <div className={`risk-level risk-${riskAssessment.level.toLowerCase()}`}>
                                <span className="risk-label">Risk Level: {riskAssessment.level}</span>
                                <span className="risk-score">Score: {riskAssessment.score}/10</span>
                            </div>
                            <div className="risk-factors">
                                <h4>Key Factors</h4>
                                <ul>
                                    {riskAssessment.factors.map((factor, idx) => (
                                        <li key={idx}>
                                            <AlertCircle size={16} />
                                            {factor}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="risk-recommendation">
                                <CheckCircle2 size={16} />
                                <span>{riskAssessment.recommendation}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default EnhancedDashboard;
