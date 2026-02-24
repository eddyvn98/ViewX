import Express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from 'url';
import useRoutes from "./routers/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
    const app = new Express();

    app.use(cookieParser());
    app.use(cors({ origin: "*" }));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Content Security Policy
    app.use((req, res, next) => {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' ws: wss: https://stream.binance.com:9443 https://api.binance.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;"
        );
        next();
    });

    app.get("/api/health", (req, res) => {
        res.status(200).json({
            status: "ok",
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });

    useRoutes(app);

    // Serve static files
    const tradingviewPath = path.join(__dirname, '../../tradingview');
    app.use('/tradingview', Express.static(tradingviewPath));
    app.use(Express.static(tradingviewPath));

    // SPA fallback
    app.get('/*splat', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        if (req.path.includes('.')) return res.status(404).send('Not Found');
        res.sendFile(path.join(tradingviewPath, 'index.html'));
    });

    return app;
}
