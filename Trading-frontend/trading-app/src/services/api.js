import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1',
});

const getStoredToken = () => localStorage.getItem('token');
const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const bootstrapToken = getStoredToken();
if (bootstrapToken) {
  api.defaults.headers.common.Authorization = `Bearer ${bootstrapToken}`;
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => response, (error) => {
  const status = error?.response?.status;
  const token = getStoredToken();
  const originalRequest = error?.config;
  const hasAuthHeader = Boolean(originalRequest?.headers?.Authorization);

  if (status === 401 && token && originalRequest && !originalRequest._retry && !hasAuthHeader) {
    originalRequest._retry = true;
    originalRequest.headers = originalRequest.headers || {};
    originalRequest.headers.Authorization = `Bearer ${token}`;
    return api(originalRequest);
  }

  if (status === 401) {
    localStorage.removeItem('token');
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
  return Promise.reject(error);
});

export const login = async (email, password) => {
  const formData = new FormData();
  formData.append('username', email); // OAuth2PasswordRequestForm expects username
  formData.append('password', password);
  const response = await api.post('/login/access-token', formData);
  return response.data;
};

export const signup = async (email, password, name) => {
  const response = await api.post('/signup', { email, password, name });
  return response.data;
};

export const fetchCurrentUser = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

export const updateCurrentUser = async (payload) => {
  const response = await api.put('/users/me', payload);
  return response.data;
};

export const fetchInstruments = async () => {
  const response = await api.get('/market/instruments');
  return response.data;
};

export const fetchZerodhaLoginUrl = async () => {
  const response = await api.get('/market/zerodha/login-url', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const createZerodhaSession = async (requestToken) => {
  const response = await api.post('/market/zerodha/session', null, {
    params: { request_token: requestToken },
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const fetchScales = async () => {
  const response = await api.get('/market/scales');
  return response.data;
};

export const fetchStrategies = async () => {
  const response = await api.get('/market/strategies');
  return response.data;
};

export const fetchHistoricalData = async (instrumentToken, scale) => {
  const response = await api.get('/market/historical-data', {
    params: { instrument_token: instrumentToken, scale },
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const fetchFinancialHistory = async (years = 5) => {
  const response = await api.get('/market/financial-history', {
    params: { years },
  });
  return response.data;
};

export const fetchCompetitors = async () => {
  const response = await api.get('/market/competitors');
  return response.data;
};

export const fetchROIProjection = async (initialInvestment = 10000, years = 5) => {
  const response = await api.get('/market/roi-projection', {
    params: { initial_investment: initialInvestment, years },
  });
  return response.data;
};

export const fetchRiskAssessment = async () => {
  const response = await api.get('/market/risk-assessment');
  return response.data;
};

export const fetchNiftyStocks = async (params = {}) => {
  const response = await api.get('/market/nifty-50', {
    params,
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const fetchBankNiftyStocks = async (params = {}) => {
  const response = await api.get('/market/bank-nifty', {
    params,
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const fetchPositions = async () => {
  const response = await api.get('/market/positions', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export default api;
