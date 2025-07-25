import { Router } from 'express';
import { FanpageController } from '../controllers/fanpage.controller'; // Sửa import
import { authMiddleware } from '../middleware/auth.middleware';
import { packageMiddleware } from '../middleware/package.middleware';

const router = Router();
const fanpageController = new FanpageController();

router.post(
    '/connect',
    authMiddleware,
    packageMiddleware,
    fanpageController.connectFanpage.bind(fanpageController)
);

router.delete(
    '/:fanpageId',
    authMiddleware,
    fanpageController.disconnectFanpage.bind(fanpageController)
);

router.post(
    '/:fanpageId/refresh-token',
    authMiddleware,
    fanpageController.refreshFanpageToken.bind(fanpageController)
);

export default router;