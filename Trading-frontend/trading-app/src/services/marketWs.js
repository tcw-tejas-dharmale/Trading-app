const RECONNECT_DELAY_MS = 2000;

let socket = null;
let reconnectTimer = null;
let sessionRetryTimer = null;
let shouldReconnect = false;
const tickListeners = new Set();
const statusListeners = new Set();
const pendingCommands = [];
const requestedTokenSubscriptions = new Set();

const isZerodhaConnected = () => localStorage.getItem('zerodha_connected') === 'true';

const markZerodhaDisconnected = () => {
  localStorage.setItem('zerodha_connected', 'false');
};

const clearSessionRetryTimer = () => {
  if (sessionRetryTimer) {
    clearTimeout(sessionRetryTimer);
    sessionRetryTimer = null;
  }
};

const scheduleZerodhaRetry = () => {
  if (!shouldReconnect || sessionRetryTimer) {
    return;
  }
  sessionRetryTimer = window.setTimeout(() => {
    sessionRetryTimer = null;
    connect();
  }, RECONNECT_DELAY_MS);
};

const flushPendingCommands = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  while (pendingCommands.length) {
    const payload = pendingCommands.shift();
    socket.send(JSON.stringify(payload));
  }
};

const queueCommand = (payload) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return;
  }
  pendingCommands.push(payload);
};

const reapplyRequestedSubscriptions = () => {
  if (!requestedTokenSubscriptions.size) {
    return;
  }
  queueCommand({
    a: 'subscribe',
    v: Array.from(requestedTokenSubscriptions),
  });
};

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
  if (!shouldReconnect) {
    return;
  }
  if (!isZerodhaConnected()) {
    scheduleZerodhaRetry();
    return;
  }
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  clearSessionRetryTimer();
  socket = new WebSocket(getWsUrl());
  socket.onopen = () => {
    notifyStatus({ type: 'status', state: 'open' });
    flushPendingCommands();
    reapplyRequestedSubscriptions();
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload?.type === 'ticks' && Array.isArray(payload.data)) {
        notifyTicks(payload.data);
      } else if (payload?.type === 'error') {
        const detail = String(payload.detail || '');
        const reason = String(payload.reason || '');
        if (detail.toLowerCase().includes('authorization') || reason.includes('403') || reason.includes('Forbidden')) {
          markZerodhaDisconnected();
          notifyStatus(payload);
          socket?.close();
          return;
        }
        notifyStatus(payload);
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
  clearSessionRetryTimer();
  shouldReconnect = false;
  if (socket) {
    socket.close();
    socket = null;
  }
  pendingCommands.length = 0;
};

const normalizeTokens = (input) => {
  if (input == null) {
    return [];
  }
  const values = Array.isArray(input) ? input : [input];
  const normalized = [];
  const seen = new Set();
  values.forEach((value) => {
    const token = Number(value);
    if (!Number.isFinite(token)) {
      return;
    }
    if (seen.has(token)) {
      return;
    }
    seen.add(token);
    normalized.push(token);
  });
  return normalized;
};

export const subscribeToTokens = (tokens) => {
  const normalized = normalizeTokens(tokens);
  if (!normalized.length) {
    return;
  }
  const newlyAdded = [];
  normalized.forEach((token) => {
    if (requestedTokenSubscriptions.has(token)) {
      return;
    }
    requestedTokenSubscriptions.add(token);
    newlyAdded.push(token);
  });
  if (!newlyAdded.length) {
    return;
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    queueCommand({ a: 'subscribe', v: newlyAdded });
  }
};

export const unsubscribeFromTokens = (tokens) => {
  const normalized = normalizeTokens(tokens);
  if (!normalized.length) {
    return;
  }
  const removed = [];
  normalized.forEach((token) => {
    if (requestedTokenSubscriptions.delete(token)) {
      removed.push(token);
    }
  });
  if (!removed.length) {
    return;
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    queueCommand({ a: 'unsubscribe', v: removed });
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
