import { Router } from 'express';

const router = Router();

// Version 1 routes will be implemented here
// import authRoutes from './v1/auth';
// import depositRoutes from './v1/deposit';
// import dashboardRoutes from './v1/dashboard';
// import syncRoutes from './v1/sync';

// router.use('/auth', authRoutes);
// router.use('/deposit', depositRoutes);
// router.use('/dashboard', dashboardRoutes);
// router.use('/sync', syncRoutes);

// Temporary placeholder
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Yield Cycle API v1',
    timestamp: new Date().toISOString(),
    routes: {
      auth: '/auth',
      deposit: '/deposit',
      dashboard: '/dashboard',
      sync: '/sync'
    }
  });
});

export default router; 