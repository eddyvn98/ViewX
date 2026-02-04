// backend/src/modules/websocket/state.js
export const clients = new Map();
export const mt5Prices = new Map(); // Store latest MT5 prices
export const candleBuffers = {};
