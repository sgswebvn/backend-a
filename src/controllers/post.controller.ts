import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Post } from '../models/post.model';
import { Fanpage } from '../models/fanpage.model';
import { FacebookService } from '../services/facebook.service';
import { AppError } from '../utils/error.util';

export class PostController {
    async createPost(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { fanpageId, content } = req.body;

            // Kiểm tra quyền truy cập fanpage
            const fanpage = await Fanpage.findOne({
                _id: fanpageId,
                userId: req.user?.id,
                isConnected: true
            });
            if (!fanpage) {
                throw new AppError('Fanpage not found or not authorized', 404);
            }

            // Gọi Facebook API để tạo bài đăng
            const fbPost = await FacebookService.createPost(fanpage.pageId, content, fanpage.accessToken);

            // Lưu bài đăng vào database
            const post = await Post.create({
                postId: fbPost.id,
                fanpageId: fanpage._id,
                content,
                createdTime: new Date(),
                updatedTime: new Date()
            });

            res.status(201).json({
                status: 'success',
                data: { post }
            });
        } catch (error) {
            next(error);
        }
    }

    async updatePost(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { postId } = req.params;
            const { content } = req.body;

            // Kiểm tra bài đăng
            const post = await Post.findOne({ _id: postId });
            if (!post) {
                throw new AppError('Post not found', 404);
            }

            // Kiểm tra quyền truy cập fanpage
            const fanpage = await Fanpage.findOne({
                _id: post.fanpageId,
                userId: req.user?.id,
                isConnected: true
            });
            if (!fanpage) {
                throw new AppError('Fanpage not found or not authorized', 404);
            }

            // Cập nhật bài đăng qua Facebook API
            await FacebookService.updatePost(post.postId, content, fanpage.accessToken);

            // Cập nhật bài đăng trong database
            post.content = content;
            post.updatedTime = new Date();
            await post.save();

            res.status(200).json({
                status: 'success',
                data: { post }
            });
        } catch (error) {
            next(error);
        }
    }

    async deletePost(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { postId } = req.params;

            // Kiểm tra bài đăng
            const post = await Post.findOne({ _id: postId });
            if (!post) {
                throw new AppError('Post not found', 404);
            }

            // Kiểm tra quyền truy cập fanpage
            const fanpage = await Fanpage.findOne({
                _id: post.fanpageId,
                userId: req.user?.id,
                isConnected: true
            });
            if (!fanpage) {
                throw new AppError('Fanpage not found or not authorized', 404);
            }

            // Xóa bài đăng qua Facebook API
            await FacebookService.deletePost(post.postId, fanpage.accessToken);

            // Xóa bài đăng khỏi database
            await post.deleteOne();

            res.status(204).json({
                status: 'success',
                message: 'Post deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}