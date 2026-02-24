import mongoose from "mongoose";

let initialized = false;
const dbState = {
    lastError: null,
    lastConnectedAt: null,
};

function mapReadyState(readyState) {
    switch (readyState) {
        case 0:
            return "disconnected";
        case 1:
            return "connected";
        case 2:
            return "connecting";
        case 3:
            return "disconnecting";
        default:
            return "unknown";
    }
}

function registerConnectionListeners() {
    if (initialized) return;
    initialized = true;

    mongoose.connection.on("connected", () => {
        dbState.lastConnectedAt = new Date().toISOString();
        dbState.lastError = null;
        console.log("[DB] Connected.");
    });

    mongoose.connection.on("error", (error) => {
        dbState.lastError = error?.message || String(error);
        console.error("[DB] Connection error:", dbState.lastError);
    });

    mongoose.connection.on("disconnected", () => {
        console.warn("[DB] Disconnected.");
    });
}

const useDatabase = async () => {
    const mongoUri = (process.env.URL_MONGOOSE || "").trim();
    if (!mongoUri) {
        throw new Error("Missing required env: URL_MONGOOSE");
    }

    registerConnectionListeners();

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });
    } catch (error) {
        dbState.lastError = error?.message || String(error);
        console.error("[DB] Initial connect failed:", dbState.lastError);
    }
};

export function getDatabaseHealth() {
    return {
        state: mapReadyState(mongoose.connection.readyState),
        readyState: mongoose.connection.readyState,
        lastError: dbState.lastError,
        lastConnectedAt: dbState.lastConnectedAt,
    };
}

export default useDatabase;
