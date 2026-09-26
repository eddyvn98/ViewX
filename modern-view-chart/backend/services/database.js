import mongoose from "mongoose";
import dns from "dns";
import { logError, logInfo, logWarn } from "../logger.js";

let initialized = false;
const dbState = {
    lastError: null,
    lastConnectedAt: null,
};

function maybeConfigureMongoDns(mongoUri) {
    const uri = String(mongoUri || "").trim().toLowerCase();
    if (!uri.startsWith("mongodb+srv://")) return;

    const configured = (process.env.MONGODB_DNS_SERVERS || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (configured.length === 0) return;
    try {
        dns.setServers(configured);
        logInfo("db.dns.override", { servers: configured });
    } catch (error) {
        logWarn("db.dns.override_failed", { error: error?.message || String(error) });
    }
}

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
        logInfo("db.connected");
    });

    mongoose.connection.on("error", (error) => {
        dbState.lastError = error?.message || String(error);
        logError("db.connection.error", { error: dbState.lastError });
    });

    mongoose.connection.on("disconnected", () => {
        logWarn("db.disconnected");
    });
}

const useDatabase = async () => {
    const mongoUri = (process.env.URL_MONGOOSE || "").trim();
    if (!mongoUri) {
        throw new Error("Missing required env: URL_MONGOOSE");
    }

    registerConnectionListeners();
    maybeConfigureMongoDns(mongoUri);

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });
    } catch (error) {
        dbState.lastError = error?.message || String(error);
        logError("db.connect.initial_failed", { error: dbState.lastError });
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
