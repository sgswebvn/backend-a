import { Router } from 'express';
import PackageController from '../controllers/package.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Public routes
router.get('/', PackageController.getPackages);
router.get('/:id', PackageController.getPackage);

// Admin only routes
router.use(authMiddleware);
router.use(adminMiddleware);
router.post('/', PackageController.createPackage);
router.put('/:id', PackageController.updatePackage);
router.delete('/:id', PackageController.deletePackage);

export default router;
