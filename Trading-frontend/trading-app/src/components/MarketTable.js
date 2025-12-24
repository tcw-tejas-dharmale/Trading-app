import React from 'react';
import './MarketTable.css';
import { TrendingUp, TrendingDown } from 'lucide-react';

const MarketTable = ({ data, type }) => {
    // Canvas or SVG for mini candle chart could be complex. 
    // Using a simple placeholder or a simplified SVG for "last 5 candles".

    return (
        <div className="market-table-container">
            <table className="market-table">
                <thead>
                    <tr>
                        {type === 'Open Position' ? (
                            <>
                                <th>Name</th>
                                <th>Quantity</th>
                                <th>Entry Price</th>
                                <th>Current Price</th>
                                <th>P&L</th>
                            </>
                        ) : (
                            <>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Last 5 Candles</th>
                                <th>Position</th>
                                <th>Action</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {data.map((item) => (
                        <tr key={item.id}>
                            {type === 'Open Position' ? (
                                <>
                                    <td>
                                        <div className="company-info">
                                            <span className="company-name">{item.name || item.tradingsymbol}</span>
                                        </div>
                                    </td>
                                    <td>{item.quantity || 100}</td> {/* Placeholder if quantity missing */}
                                    <td>₹{item.entry_price || item.average_price || 0}</td>
                                    <td>₹{item.last_price || 0}</td>
                                    <td>
                                        <span className={item.pnl >= 0 ? "text-success" : "text-danger"}>
                                            {item.pnl ? `₹${item.pnl}` : '-'}
                                        </span>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td>{item.id}</td>
                                    <td>
                                        <div className="company-info">
                                            <span className="company-name">{item.name}</span>
                                            <span className="company-sector">{item.sector || 'Index'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="mini-chart">
                                            {item.candles && item.candles.map((candle, idx) => {
                                                const isGreen = candle.close >= candle.open;
                                                return (
                                                    <div key={idx} className={`candle ${isGreen ? 'green' : 'red'}`} style={{ height: '20px', width: '4px', display: 'inline-block', margin: '0 1px' }}></div>
                                                );
                                            })}
                                            {!item.candles && <span className="text-muted text-xs">No Data</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`position-badge ${item.position === 'LONG' ? 'long' : 'short'}`}>
                                            {item.position || 'NEUTRAL'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-buy">Buy</button>
                                            <button className="btn-sell">Sell</button>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MarketTable;
