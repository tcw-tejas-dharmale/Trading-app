import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1', // Adjust if backend port differs
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (email, password) => {
  const formData = new FormData();
  formData.append('username', email); // OAuth2PasswordRequestForm expects username
  formData.append('password', password);
  const response = await api.post('/login/access-token', formData);
  return response.data;
};

export const fetchInstruments = async () => {
  const response = await api.get('/market/instruments');
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
  });
  return response.data;
};

export default api;
