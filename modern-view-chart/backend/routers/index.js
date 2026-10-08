import userRouter from '../modules/user/user.routes.js'
import aiBridgeRouter from './ai-bridge-router.js'
import authRouter from "../modules/auth/auth.routes.js";
import ttsRouter from './tts-router.js';
import chartRouter from '../modules/chart/chart.routes.js';

const useRoutes = (app) => {
    app.use("/api/auth", authRouter);
    app.use('/api/user', userRouter);
    app.use('/api/ai/bridge', aiBridgeRouter);
    app.use('/api/tts', ttsRouter);
    app.use('/api/chart', chartRouter);
};

export default useRoutes;
