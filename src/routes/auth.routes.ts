import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Protected routes
router.get('/me', authMiddleware, AuthController.getMe);
router.get('/facebook/callback', authMiddleware, AuthController.facebookCallback);
router.get('/facebook/login', AuthController.facebookLogin);

export default router;
