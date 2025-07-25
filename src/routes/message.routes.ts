import { Router } from 'express';
import MessageController from '../controllers/message.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/:conversationId', MessageController.getMessages);
router.post('/:conversationId', MessageController.sendMessage);

export default router;
