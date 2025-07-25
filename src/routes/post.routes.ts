// src/routes/post.routes.ts
import { Router } from 'express';
import { PostController } from '../controllers/post.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const postController = new PostController();

router.post(
    '/:fanpageId',
    authMiddleware,
    postController.createPost.bind(postController)
);

router.put(
    '/:postId',
    authMiddleware,
    postController.updatePost.bind(postController)
);

router.delete(
    '/:postId',
    authMiddleware,
    postController.deletePost.bind(postController)
);

export default router;