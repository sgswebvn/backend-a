import { Router } from 'express';
import PaymentController from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/callback', PaymentController.paymentCallback);

// Protected routes
router.use(authMiddleware);
router.get('/', PaymentController.getPayments);
router.post('/', PaymentController.createPayment);

export default router;
