import React from 'react';
import './Nifty50Page.css';

const NIFTY_50 = [
  { srNo: 1, underlying: '360 ONE WAM LIMITED', symbol: '360ONE' },
  { srNo: 2, underlying: 'ABB India Limited', symbol: 'ABB' },
  { srNo: 3, underlying: 'APL Apollo Tubes Limited', symbol: 'APLAPOLLO' },
  { srNo: 4, underlying: 'AU Small Finance Bank Limited', symbol: 'AUBANK' },
  { srNo: 5, underlying: 'Adani Energy Solutions Limited', symbol: 'ADANIENSOL' },
  { srNo: 6, underlying: 'Adani Enterprises Limited', symbol: 'ADANIENT' },
  { srNo: 7, underlying: 'Adani Green Energy Limited', symbol: 'ADANIGREEN' },
  { srNo: 8, underlying: 'Adani Ports and Special Economic Zone Limited', symbol: 'ADANIPORTS' },
  { srNo: 9, underlying: 'Aditya Birla Capital Limited', symbol: 'ABCAPITAL' },
  { srNo: 10, underlying: 'Alkem Laboratories Limited', symbol: 'ALKEM' },
  { srNo: 11, underlying: 'Amber Enterprises India Limited', symbol: 'AMBER' },
  { srNo: 12, underlying: 'Ambuja Cements Limited', symbol: 'AMBUJACEM' },
  { srNo: 13, underlying: 'Angel One Limited', symbol: 'ANGELONE' },
  { srNo: 14, underlying: 'Apollo Hospitals Enterprise Limited', symbol: 'APOLLOHOSP' },
  { srNo: 15, underlying: 'Ashok Leyland Limited', symbol: 'ASHOKLEY' },
  { srNo: 16, underlying: 'Asian Paints Limited', symbol: 'ASIANPAINT' },
  { srNo: 17, underlying: 'Astral Limited', symbol: 'ASTRAL' },
  { srNo: 18, underlying: 'Aurobindo Pharma Limited', symbol: 'AUROPHARMA' },
  { srNo: 19, underlying: 'Avenue Supermarts Limited', symbol: 'DMART' },
  { srNo: 20, underlying: 'Axis Bank Limited', symbol: 'AXISBANK' },
  { srNo: 21, underlying: 'BSE Limited', symbol: 'BSE' },
  { srNo: 22, underlying: 'Bajaj Auto Limited', symbol: 'BAJAJ-AUTO' },
  { srNo: 23, underlying: 'Bajaj Finance Limited', symbol: 'BAJFINANCE' },
  { srNo: 24, underlying: 'Bajaj Finserv Limited', symbol: 'BAJAJFINSV' },
  { srNo: 25, underlying: 'Bajaj Holdings & Investment Limited', symbol: 'BAJAJHLDNG' },
  { srNo: 26, underlying: 'Bandhan Bank Limited', symbol: 'BANDHANBNK' },
  { srNo: 27, underlying: 'Bank of Baroda', symbol: 'BANKBARODA' },
  { srNo: 28, underlying: 'Bank of India', symbol: 'BANKINDIA' },
  { srNo: 29, underlying: 'Bharat Dynamics Limited', symbol: 'BDL' },
  { srNo: 30, underlying: 'Bharat Electronics Limited', symbol: 'BEL' },
  { srNo: 31, underlying: 'Bharat Forge Limited', symbol: 'BHARATFORG' },
  { srNo: 32, underlying: 'Bharat Heavy Electricals Limited', symbol: 'BHEL' },
  { srNo: 33, underlying: 'Bharat Petroleum Corporation Limited', symbol: 'BPCL' },
  { srNo: 34, underlying: 'Bharti Airtel Limited', symbol: 'BHARTIARTL' },
  { srNo: 35, underlying: 'Biocon Limited', symbol: 'BIOCON' },
  { srNo: 36, underlying: 'Blue Star Limited', symbol: 'BLUESTARCO' },
  { srNo: 37, underlying: 'Bosch Limited', symbol: 'BOSCHLTD' },
  { srNo: 38, underlying: 'Britannia Industries Limited', symbol: 'BRITANNIA' },
  { srNo: 39, underlying: 'CG Power and Industrial Solutions Limited', symbol: 'CGPOWER' },
  { srNo: 40, underlying: 'Canara Bank', symbol: 'CANBK' },
  { srNo: 41, underlying: 'Central Depository Services (India) Limited', symbol: 'CDSL' },
  { srNo: 42, underlying: 'Cholamandalam Investment and Finance Company Limited', symbol: 'CHOLAFIN' },
  { srNo: 43, underlying: 'Cipla Limited', symbol: 'CIPLA' },
  { srNo: 44, underlying: 'Coal India Limited', symbol: 'COALINDIA' },
  { srNo: 45, underlying: 'Coforge Limited', symbol: 'COFORGE' },
  { srNo: 46, underlying: 'Colgate Palmolive (India) Limited', symbol: 'COLPAL' },
  { srNo: 47, underlying: 'Computer Age Management Services Limited', symbol: 'CAMS' },
  { srNo: 48, underlying: 'Container Corporation of India Limited', symbol: 'CONCOR' },
  { srNo: 49, underlying: 'Crompton Greaves Consumer Electricals Limited', symbol: 'CROMPTON' },
  { srNo: 50, underlying: 'Cummins India Limited', symbol: 'CUMMINSIND' },
  { srNo: 51, underlying: 'DLF Limited', symbol: 'DLF' },
  { srNo: 52, underlying: 'Dabur India Limited', symbol: 'DABUR' },
  { srNo: 53, underlying: 'Dalmia Bharat Limited', symbol: 'DALBHARAT' },
  { srNo: 54, underlying: 'Delhivery Limited', symbol: 'DELHIVERY' },
  { srNo: 55, underlying: "Divi's Laboratories Limited", symbol: 'DIVISLAB' },
  { srNo: 56, underlying: 'Dixon Technologies (India) Limited', symbol: 'DIXON' },
  { srNo: 57, underlying: "Dr. Reddy's Laboratories Limited", symbol: 'DRREDDY' },
  { srNo: 58, underlying: 'ETERNAL LIMITED', symbol: 'ETERNAL' },
  { srNo: 59, underlying: 'Eicher Motors Limited', symbol: 'EICHERMOT' },
  { srNo: 60, underlying: 'Exide Industries Limited', symbol: 'EXIDEIND' },
  { srNo: 61, underlying: 'FSN E-Commerce Ventures Limited', symbol: 'NYKAA' },
  { srNo: 62, underlying: 'Fortis Healthcare Limited', symbol: 'FORTIS' },
  { srNo: 63, underlying: 'GAIL (India) Limited', symbol: 'GAIL' },
  { srNo: 64, underlying: 'GMR AIRPORTS LIMITED', symbol: 'GMRAIRPORT' },
  { srNo: 65, underlying: 'Glenmark Pharmaceuticals Limited', symbol: 'GLENMARK' },
  { srNo: 66, underlying: 'Godrej Consumer Products Limited', symbol: 'GODREJCP' },
  { srNo: 67, underlying: 'Godrej Properties Limited', symbol: 'GODREJPROP' },
  { srNo: 68, underlying: 'Grasim Industries Limited', symbol: 'GRASIM' },
  { srNo: 69, underlying: 'HCL Technologies Limited', symbol: 'HCLTECH' },
  { srNo: 70, underlying: 'HDFC Asset Management Company Limited', symbol: 'HDFCAMC' },
  { srNo: 71, underlying: 'HDFC Bank Limited', symbol: 'HDFCBANK' },
  { srNo: 72, underlying: 'HDFC Life Insurance Company Limited', symbol: 'HDFCLIFE' },
  { srNo: 73, underlying: 'Havells India Limited', symbol: 'HAVELLS' },
  { srNo: 74, underlying: 'Hero MotoCorp Limited', symbol: 'HEROMOTOCO' },
  { srNo: 75, underlying: 'Hindalco Industries Limited', symbol: 'HINDALCO' },
  { srNo: 76, underlying: 'Hindustan Aeronautics Limited', symbol: 'HAL' },
  { srNo: 77, underlying: 'Hindustan Petroleum Corporation Limited', symbol: 'HINDPETRO' },
  { srNo: 78, underlying: 'Hindustan Unilever Limited', symbol: 'HINDUNILVR' },
  { srNo: 79, underlying: 'Hindustan Zinc Limited', symbol: 'HINDZINC' },
  { srNo: 80, underlying: 'Hitachi Energy India Limited', symbol: 'POWERINDIA' },
  { srNo: 81, underlying: 'Housing & Urban Development Corporation Limited', symbol: 'HUDCO' },
  { srNo: 82, underlying: 'ICICI Bank Limited', symbol: 'ICICIBANK' },
  { srNo: 83, underlying: 'ICICI Lombard General Insurance Company Limited', symbol: 'ICICIGI' },
  { srNo: 84, underlying: 'ICICI Prudential Life Insurance Company Limited', symbol: 'ICICIPRULI' },
  { srNo: 85, underlying: 'IDFC First Bank Limited', symbol: 'IDFCFIRSTB' },
  { srNo: 86, underlying: 'IIFL Finance Limited', symbol: 'IIFL' },
  { srNo: 87, underlying: 'ITC Limited', symbol: 'ITC' },
  { srNo: 88, underlying: 'Indian Bank', symbol: 'INDIANB' },
  { srNo: 89, underlying: 'Indian Energy Exchange Limited', symbol: 'IEX' },
  { srNo: 90, underlying: 'Indian Oil Corporation Limited', symbol: 'IOC' },
  { srNo: 91, underlying: 'Indian Railway Catering And Tourism Corporation Limited', symbol: 'IRCTC' },
  { srNo: 92, underlying: 'Indian Railway Finance Corporation Limited', symbol: 'IRFC' },
  { srNo: 93, underlying: 'Indian Renewable Energy Development Agency Limited', symbol: 'IREDA' },
  { srNo: 94, underlying: 'Indus Towers Limited', symbol: 'INDUSTOWER' },
  { srNo: 95, underlying: 'IndusInd Bank Limited', symbol: 'INDUSINDBK' },
  { srNo: 96, underlying: 'Info Edge (India) Limited', symbol: 'NAUKRI' },
  { srNo: 97, underlying: 'Infosys Limited', symbol: 'INFY' },
  { srNo: 98, underlying: 'Inox Wind Limited', symbol: 'INOXWIND' },
  { srNo: 99, underlying: 'InterGlobe Aviation Limited', symbol: 'INDIGO' },
  { srNo: 100, underlying: 'JINDAL STEEL LIMITED', symbol: 'JINDALSTEL' },
  { srNo: 101, underlying: 'JSW Energy Limited', symbol: 'JSWENERGY' },
  { srNo: 102, underlying: 'JSW Steel Limited', symbol: 'JSWSTEEL' },
  { srNo: 103, underlying: 'Jio Financial Services Limited', symbol: 'JIOFIN' },
  { srNo: 104, underlying: 'Jubilant Foodworks Limited', symbol: 'JUBLFOOD' },
  { srNo: 105, underlying: 'KEI Industries Limited', symbol: 'KEI' },
  { srNo: 106, underlying: 'KPIT Technologies Limited', symbol: 'KPITTECH' },
  { srNo: 107, underlying: 'Kalyan Jewellers India Limited', symbol: 'KALYANKJIL' },
  { srNo: 108, underlying: 'Kaynes Technology India Limited', symbol: 'KAYNES' },
  { srNo: 109, underlying: 'Kfin Technologies Limited', symbol: 'KFINTECH' },
  { srNo: 110, underlying: 'Kotak Mahindra Bank Limited', symbol: 'KOTAKBANK' },
  { srNo: 111, underlying: 'L&T Finance Limited', symbol: 'LTF' },
  { srNo: 112, underlying: 'LIC Housing Finance Limited', symbol: 'LICHSGFIN' },
  { srNo: 113, underlying: 'LTIMindtree Limited', symbol: 'LTIM' },
  { srNo: 114, underlying: 'Larsen & Toubro Limited', symbol: 'LT' },
  { srNo: 115, underlying: 'Laurus Labs Limited', symbol: 'LAURUSLABS' },
  { srNo: 116, underlying: 'Life Insurance Corporation Of India', symbol: 'LICI' },
  { srNo: 117, underlying: 'Lodha Developers Limited', symbol: 'LODHA' },
  { srNo: 118, underlying: 'Lupin Limited', symbol: 'LUPIN' },
  { srNo: 119, underlying: 'Mahindra & Mahindra Limited', symbol: 'M&M' },
  { srNo: 120, underlying: 'Manappuram Finance Limited', symbol: 'MANAPPURAM' },
  { srNo: 121, underlying: 'Mankind Pharma Limited', symbol: 'MANKIND' },
  { srNo: 122, underlying: 'Marico Limited', symbol: 'MARICO' },
  { srNo: 123, underlying: 'Maruti Suzuki India Limited', symbol: 'MARUTI' },
  { srNo: 124, underlying: 'Max Financial Services Limited', symbol: 'MFSL' },
  { srNo: 125, underlying: 'Max Healthcare Institute Limited', symbol: 'MAXHEALTH' },
  { srNo: 126, underlying: 'Mazagon Dock Shipbuilders Limited', symbol: 'MAZDOCK' },
  { srNo: 127, underlying: 'MphasiS Limited', symbol: 'MPHASIS' },
  { srNo: 128, underlying: 'Multi Commodity Exchange of India Limited', symbol: 'MCX' },
  { srNo: 129, underlying: 'Muthoot Finance Limited', symbol: 'MUTHOOTFIN' },
  { srNo: 130, underlying: 'NBCC (India) Limited', symbol: 'NBCC' },
  { srNo: 131, underlying: 'NHPC Limited', symbol: 'NHPC' },
  { srNo: 132, underlying: 'NMDC Limited', symbol: 'NMDC' },
  { srNo: 133, underlying: 'NTPC Limited', symbol: 'NTPC' },
  { srNo: 134, underlying: 'National Aluminium Company Limited', symbol: 'NATIONALUM' },
  { srNo: 135, underlying: 'Nestle India Limited', symbol: 'NESTLEIND' },
  { srNo: 136, underlying: 'Nuvama Wealth Management Limited', symbol: 'NUVAMA' },
  { srNo: 137, underlying: 'Oberoi Realty Limited', symbol: 'OBEROIRLTY' },
  { srNo: 138, underlying: 'Oil & Natural Gas Corporation Limited', symbol: 'ONGC' },
  { srNo: 139, underlying: 'Oil India Limited', symbol: 'OIL' },
  { srNo: 140, underlying: 'One 97 Communications Limited', symbol: 'PAYTM' },
  { srNo: 141, underlying: 'Oracle Financial Services Software Limited', symbol: 'OFSS' },
  { srNo: 142, underlying: 'PB Fintech Limited', symbol: 'POLICYBZR' },
  { srNo: 143, underlying: 'PG Electroplast Limited', symbol: 'PGEL' },
  { srNo: 144, underlying: 'PI Industries Limited', symbol: 'PIIND' },
  { srNo: 145, underlying: 'PNB Housing Finance Limited', symbol: 'PNBHOUSING' },
  { srNo: 146, underlying: 'Page Industries Limited', symbol: 'PAGEIND' },
  { srNo: 147, underlying: 'Patanjali Foods Limited', symbol: 'PATANJALI' },
  { srNo: 148, underlying: 'Persistent Systems Limited', symbol: 'PERSISTENT' },
  { srNo: 149, underlying: 'Petronet LNG Limited', symbol: 'PETRONET' },
  { srNo: 150, underlying: 'Pidilite Industries Limited', symbol: 'PIDILITIND' },
  { srNo: 151, underlying: 'Piramal Pharma Limited', symbol: 'PPLPHARMA' },
  { srNo: 152, underlying: 'Polycab India Limited', symbol: 'POLYCAB' },
  { srNo: 153, underlying: 'Power Finance Corporation Limited', symbol: 'PFC' },
  { srNo: 154, underlying: 'Power Grid Corporation of India Limited', symbol: 'POWERGRID' },
  { srNo: 155, underlying: 'Premier Energies Limited', symbol: 'PREMIERENE' },
  { srNo: 156, underlying: 'Prestige Estates Projects Limited', symbol: 'PRESTIGE' },
  { srNo: 157, underlying: 'Punjab National Bank', symbol: 'PNB' },
  { srNo: 158, underlying: 'RBL Bank Limited', symbol: 'RBLBANK' },
  { srNo: 159, underlying: 'REC Limited', symbol: 'RECLTD' },
  { srNo: 160, underlying: 'Rail Vikas Nigam Limited', symbol: 'RVNL' },
  { srNo: 161, underlying: 'Reliance Industries Limited', symbol: 'RELIANCE' },
  { srNo: 162, underlying: 'SBI Cards and Payment Services Limited', symbol: 'SBICARD' },
  { srNo: 163, underlying: 'SBI Life Insurance Company Limited', symbol: 'SBILIFE' },
  { srNo: 164, underlying: 'SHREE CEMENT LIMITED', symbol: 'SHREECEM' },
  { srNo: 165, underlying: 'SRF Limited', symbol: 'SRF' },
  { srNo: 166, underlying: 'Sammaan Capital Limited', symbol: 'SAMMAANCAP' },
  { srNo: 167, underlying: 'Samvardhana Motherson International Limited', symbol: 'MOTHERSON' },
  { srNo: 168, underlying: 'Shriram Finance Limited', symbol: 'SHRIRAMFIN' },
  { srNo: 169, underlying: 'Siemens Limited', symbol: 'SIEMENS' },
  { srNo: 170, underlying: 'Solar Industries India Limited', symbol: 'SOLARINDS' },
  { srNo: 171, underlying: 'Sona BLW Precision Forgings Limited', symbol: 'SONACOMS' },
  { srNo: 172, underlying: 'State Bank of India', symbol: 'SBIN' },
  { srNo: 173, underlying: 'Steel Authority of India Limited', symbol: 'SAIL' },
  { srNo: 174, underlying: 'Sun Pharmaceutical Industries Limited', symbol: 'SUNPHARMA' },
  { srNo: 175, underlying: 'Supreme Industries Limited', symbol: 'SUPREMEIND' },
  { srNo: 176, underlying: 'Suzlon Energy Limited', symbol: 'SUZLON' },
  { srNo: 177, underlying: 'Swiggy Limited', symbol: 'SWIGGY' },
  { srNo: 178, underlying: 'Syngene International Limited', symbol: 'SYNGENE' },
  { srNo: 179, underlying: 'TATA CONSUMER PRODUCTS LIMITED', symbol: 'TATACONSUM' },
  { srNo: 180, underlying: 'TVS Motor Company Limited', symbol: 'TVSMOTOR' },
  { srNo: 181, underlying: 'Tata Consultancy Services Limited', symbol: 'TCS' },
  { srNo: 182, underlying: 'Tata Elxsi Limited', symbol: 'TATAELXSI' },
  { srNo: 183, underlying: 'Tata Motors Passenger Vehicles Limited', symbol: 'TMPV' },
  { srNo: 184, underlying: 'Tata Power Company Limited', symbol: 'TATAPOWER' },
  { srNo: 185, underlying: 'Tata Steel Limited', symbol: 'TATASTEEL' },
  { srNo: 186, underlying: 'Tata Technologies Limited', symbol: 'TATATECH' },
  { srNo: 187, underlying: 'Tech Mahindra Limited', symbol: 'TECHM' },
  { srNo: 188, underlying: 'The Federal Bank Limited', symbol: 'FEDERALBNK' },
  { srNo: 189, underlying: 'The Indian Hotels Company Limited', symbol: 'INDHOTEL' },
  { srNo: 190, underlying: 'The Phoenix Mills Limited', symbol: 'PHOENIXLTD' },
  { srNo: 191, underlying: 'Titan Company Limited', symbol: 'TITAN' },
  { srNo: 192, underlying: 'Torrent Pharmaceuticals Limited', symbol: 'TORNTPHARM' },
  { srNo: 193, underlying: 'Torrent Power Limited', symbol: 'TORNTPOWER' },
  { srNo: 194, underlying: 'Trent Limited', symbol: 'TRENT' },
  { srNo: 195, underlying: 'Tube Investments of India Limited', symbol: 'TIINDIA' },
  { srNo: 196, underlying: 'UNO Minda Limited', symbol: 'UNOMINDA' },
  { srNo: 197, underlying: 'UPL Limited', symbol: 'UPL' },
  { srNo: 198, underlying: 'UltraTech Cement Limited', symbol: 'ULTRACEMCO' },
  { srNo: 199, underlying: 'Union Bank of India', symbol: 'UNIONBANK' },
  { srNo: 200, underlying: 'United Spirits Limited', symbol: 'UNITDSPR' },
  { srNo: 201, underlying: 'Varun Beverages Limited', symbol: 'VBL' },
  { srNo: 202, underlying: 'Vedanta Limited', symbol: 'VEDL' },
  { srNo: 203, underlying: 'Vodafone Idea Limited', symbol: 'IDEA' },
  { srNo: 204, underlying: 'Voltas Limited', symbol: 'VOLTAS' },
  { srNo: 205, underlying: 'Waaree Energies Limited', symbol: 'WAAREEENER' },
  { srNo: 206, underlying: 'Wipro Limited', symbol: 'WIPRO' },
  { srNo: 207, underlying: 'Yes Bank Limited', symbol: 'YESBANK' },
  { srNo: 208, underlying: 'Zydus Lifesciences Limited', symbol: 'ZYDUSLIFE' },
];

const Nifty50Page = () => {
  return (
    <section className="nifty50-page">
      <div className="container">
        <header className="nifty50-hero">
          <div className="nifty50-hero-content">
            <p className="nifty50-eyebrow">Market Snapshot</p>
            <h1>Nifty 50 Constituents</h1>
            <p className="nifty50-subtitle">
              A curated view of large-cap leaders with ticker symbols ready for screening.
            </p>
          </div>
          <div className="nifty50-hero-card">
            <div>
              <p className="nifty50-stat-label">Constituents</p>
              <p className="nifty50-stat-value">{NIFTY_50.length}</p>
            </div>
            <div>
              <p className="nifty50-stat-label">Universe</p>
              <p className="nifty50-stat-value">NSE</p>
            </div>
          </div>
        </header>

        <div className="nifty50-table card">
          <div className="nifty50-table-header">
            <div>
              <h2>Company List</h2>
              <p>Static snapshot for quick reference in the trading workspace.</p>
            </div>
          </div>
          <div className="nifty50-table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Underlying</th>
                  <th scope="col">Symbol</th>
                </tr>
              </thead>
              <tbody>
                {NIFTY_50.map((row) => (
                  <tr key={row.symbol}>
                    <td>{row.srNo}</td>
                    <td>{row.underlying}</td>
                    <td>{row.symbol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Nifty50Page;
