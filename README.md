# Trading App - Advanced Trading Platform

## Overview
A modern trading application allowing users to view real-time (simulated) market data, select instruments, apply strategies, and visualize trends with interactive charts. Built with FastAPI (Python) and React.

## Features
- **Instrument Selection**: Choose from various stocks and indices (mocked Zerodha data).
- **Time Scales**: Switch between different time intervals (1m to 1d).
- **Strategies**: Select trading strategies to overlay on data.
- **Authentication**: Secure JWT-based login system.
- **Visualizations**: Interactive Candlestick/Line charts using Chart.js.
- **Professional UI**: Dark-themed, responsive design.

## Prerequisites
- Node.js (v16+)
- Python (3.9+)
- PostgreSQL Database

## Setup Instructions

### 1. Database Setup
Ensure you have a PostgreSQL database running. Create a database named `trading_db`.
UPDATE `Trading-backend/.env` with your credentials (see `.env.example`).
If you need to create the user/pass:
```sql
CREATE DATABASE trading_db;
CREATE USER postgres WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE trading_db TO postgres;
```

### 2. Backend Setup
Navigate to `Trading-backend`:
```bash
cd Trading-backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file based on `.env.example` and update the values.

Run the server:
```bash
uvicorn app.main:app --reload
```
The API will run at `http://localhost:8000`. Documentation at `http://localhost:8000/docs`.

### 3. Frontend Setup
Navigate to `Trading-frontend/trading-app`:
```bash
cd Trading-frontend/trading-app
npm install
npm start
```
The app will open at `http://localhost:3000`.

### 4. Logging In
Since this is a fresh setup, you can register a new user via the API docs (`/docs` -> `/signup`) OR you can use the built-in "Sign Up" if implemented, currently the UI focuses on Login. 
To create a user quickly, use the Swagger UI at `http://localhost:8000/docs`:
1. Expand `POST /api/v1/signup`.
2. Click "Try it out".
3. Enter valid JSON for user creation (email, password).
4. Execute.
5. Use these credentials to log in on the frontend.

## Project Structure
- **Trading-backend**: FastAPI app with MVC structure (Routes, Controllers, Models).
- **Trading-frontend**: React app with modern components and styling.
