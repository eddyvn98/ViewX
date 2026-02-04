import axios from 'axios';
import crypto from 'crypto';

// Use Binance Testnet by default for "Demo"
const API_KEY = process.env.BINANCE_API_KEY || '';
const API_SECRET = process.env.BINANCE_API_SECRET || '';
const BASE_URL = process.env.BINANCE_BASE_URL || 'https://testnet.binance.vision';

const createSignature = (queryString) => {
    return crypto
        .createHmac('sha256', API_SECRET)
        .update(queryString)
        .digest('hex');
};

export const binanceTradingService = {
    /**
     * Get Account Information (Balances)
     */
    getAccountInfo: async () => {
        if (!API_KEY) return null;
        try {
            const endpoint = '/api/v3/account';
            const timestamp = Date.now();
            const queryString = `timestamp=${timestamp}`;
            const signature = createSignature(queryString);

            const response = await axios.get(`${BASE_URL}${endpoint}?${queryString}&signature=${signature}`, {
                headers: { 'X-MBX-APIKEY': API_KEY }
            });

            return response.data;
        } catch (error) {
            console.error('Binance Account Info Error:', error.response?.data || error.message);
            throw error;
        }
    },

    /**
     * Get Open Orders (Equivalent to Positions in Spot)
     */
    getOpenOrders: async (symbol = null) => {
        if (!API_KEY) return [];
        try {
            const endpoint = '/api/v3/openOrders';
            const timestamp = Date.now();
            let queryString = `timestamp=${timestamp}`;
            if (symbol) queryString = `symbol=${symbol.toUpperCase()}&${queryString}`;

            const signature = createSignature(queryString);
            const response = await axios.get(`${BASE_URL}${endpoint}?${queryString}&signature=${signature}`, {
                headers: { 'X-MBX-APIKEY': API_KEY }
            });

            return response.data;
        } catch (error) {
            console.error('Binance Open Orders Error:', error.response?.data || error.message);
            throw error;
        }
    },

    /**
     * Get Recent Trade History
     */
    getTradeHistory: async (symbol) => {
        if (!API_KEY || !symbol) return [];
        try {
            const endpoint = '/api/v3/myTrades';
            const timestamp = Date.now();
            const queryString = `symbol=${symbol.toUpperCase()}&timestamp=${timestamp}`;
            const signature = createSignature(queryString);

            const response = await axios.get(`${BASE_URL}${endpoint}?${queryString}&signature=${signature}`, {
                headers: { 'X-MBX-APIKEY': API_KEY }
            });

            return response.data;
        } catch (error) {
            console.error('Binance Trade History Error:', error.response?.data || error.message);
            return [];
        }
    },

    /**
     * Place New Order
     */
    placeOrder: async (symbol, side, type, quantity, price = null) => {
        if (!API_KEY) throw new Error("Binance API Key is required");
        try {
            const endpoint = '/api/v3/order';
            const timestamp = Date.now();

            let queryParams = [
                `symbol=${symbol.toUpperCase()}`,
                `side=${side.toUpperCase()}`,
                `type=${type.toUpperCase()}`,
                `quantity=${quantity}`,
                `timestamp=${timestamp}`
            ];

            if (type.toUpperCase() === 'LIMIT' && price) {
                queryParams.push(`price=${price}`);
                queryParams.push(`timeInForce=GTC`);
            }

            const queryString = queryParams.join('&');
            const signature = createSignature(queryString);

            const response = await axios.post(`${BASE_URL}${endpoint}?${queryString}&signature=${signature}`, null, {
                headers: { 'X-MBX-APIKEY': API_KEY }
            });

            return response.data;
        } catch (error) {
            console.error('Binance Place Order Error:', error.response?.data || error.message);
            throw error;
        }
    },

    /**
     * Cancel Order
     */
    cancelOrder: async (symbol, orderId) => {
        if (!API_KEY) throw new Error("Binance API Key is required");
        try {
            const endpoint = '/api/v3/order';
            const timestamp = Date.now();
            const queryString = `symbol=${symbol.toUpperCase()}&orderId=${orderId}&timestamp=${timestamp}`;
            const signature = createSignature(queryString);

            const response = await axios.delete(`${BASE_URL}${endpoint}?${queryString}&signature=${signature}`, {
                headers: { 'X-MBX-APIKEY': API_KEY }
            });

            return response.data;
        } catch (error) {
            console.error('Binance Cancel Order Error:', error.response?.data || error.message);
            throw error;
        }
    }
};
