const RECONNECT_DELAY_MS = 2000;

let socket = null;
let reconnectTimer = null;
let shouldReconnect = false;
const tickListeners = new Set();
const statusListeners = new Set();

const getWsUrl = () => {
  const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';
  const wsBase = baseUrl.replace(/^http/, 'ws');
  const token = localStorage.getItem('token');
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${wsBase}/market/ws/quotes${query}`;
};

const notifyTicks = (ticks) => {
  tickListeners.forEach((listener) => listener(ticks));
};

const notifyStatus = (status) => {
  statusListeners.forEach((listener) => listener(status));
};

const scheduleReconnect = () => {
  if (!shouldReconnect || reconnectTimer) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY_MS);
};

const connect = () => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  socket = new WebSocket(getWsUrl());
  socket.onopen = () => {
    notifyStatus({ type: 'status', state: 'open' });
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload?.type === 'ticks' && Array.isArray(payload.data)) {
        notifyTicks(payload.data);
      } else {
        notifyStatus(payload);
      }
    } catch (error) {
      notifyStatus({ type: 'error', detail: 'Malformed websocket payload.' });
    }
  };
  socket.onerror = () => {
    notifyStatus({ type: 'error', detail: 'Websocket error.' });
  };
  socket.onclose = () => {
    socket = null;
    notifyStatus({ type: 'status', state: 'closed' });
    scheduleReconnect();
  };
};

const close = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  shouldReconnect = false;
  if (socket) {
    socket.close();
    socket = null;
  }
};

export const subscribeMarketTicks = (listener) => {
  tickListeners.add(listener);
  shouldReconnect = true;
  connect();
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0) {
      close();
    }
  };
};

export const subscribeMarketStatus = (listener) => {
  statusListeners.add(listener);
  shouldReconnect = true;
  connect();
  return () => {
    statusListeners.delete(listener);
    if (statusListeners.size === 0 && tickListeners.size === 0) {
      close();
    }
  };
};
