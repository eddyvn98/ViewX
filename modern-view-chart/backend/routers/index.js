import userRouter from '../modules/user/user.routes.js'
import aiBridgeRouter from './ai-bridge-router.js'

const useRoutes = (app) => {
    app.use('/api/user', userRouter);
    app.use('/api/ai/bridge', aiBridgeRouter);
    // app.use('/api/chart', userRouter);
};

export default useRoutes;
