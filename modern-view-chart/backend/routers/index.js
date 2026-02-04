import userRouter from '../modules/user/user.routes.js'

const useRoutes = (app) => {
    app.use('/api/user', userRouter);
    // app.use('/api/chart', userRouter);
};

export default useRoutes;
