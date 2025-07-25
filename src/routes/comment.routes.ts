import { Router } from 'express';
import CommentController from '../controllers/comment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/:postId', CommentController.getComments);
router.post('/:commentId/reply', CommentController.replyToComment);

export default router;
