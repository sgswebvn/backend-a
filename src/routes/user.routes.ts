import { Router } from 'express';
import UserController from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', UserController.getUserStats);
router.get('/', UserController.getUsers);
router.get('/:id', UserController.getUser);
router.put('/:id', UserController.updateUser);
router.delete('/:id', UserController.deleteUser);
router.put('/notification-preferences', UserController.updateNotificationPreferences);
export default router;
