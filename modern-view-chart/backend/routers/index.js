import userRouter from '../modules/user/user.routes.js'
import aiBridgeRouter from './ai-bridge-router.js'
import authRouter from "../modules/auth/auth.routes.js";

const useRoutes = (app) => {
    app.use("/api/auth", authRouter);
    app.use('/api/user', userRouter);
    app.use('/api/ai/bridge', aiBridgeRouter);
    // app.use('/api/chart', userRouter);
};

export default useRoutes;
