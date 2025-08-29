import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Post, IPost } from '../models/post.model';
import { Fanpage, IFanpage } from '../models/fanpage.model';
import { FacebookService } from '../services/facebook.service';
import { AppError } from '../utils/error.util';

export class PostController {
    async getPosts(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { fanpageId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            if (!fanpageId || !/^[0-9_]+$/.test(fanpageId)) {
                throw new AppError('Invalid fanpageId', 400);
            }

            const fanpage = await Fanpage.findOne<IFanpage>({
                pageId: fanpageId,
                userId: req.user?.id,
                isConnected: true,
            });

            if (!fanpage) {
                throw new AppError('Fanpage not found or not authorized', 404);
            }

            let posts = await Post.find<IPost>({ fanpageId: fanpage._id })
                .sort({ createdTime: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit));

            if (posts.length === 0) {
                const fbPosts = await FacebookService.getPosts(fanpage.pageId, fanpage.accessToken);
                const bulkOps = fbPosts.map((fbPost) => ({
                    updateOne: {
                        filter: { postId: fbPost.id },
                        update: {
                            $set: {
                                fanpageId: fanpage._id,
                                content: fbPost.message || '',
                                createdTime: new Date(fbPost.created_time),
                                updatedTime: new Date(fbPost.updated_time),
                                likes: fbPost.likes?.summary.total_count || 0,
                                shares: fbPost.shares?.count || 0,
                                picture: fbPost.full_picture || '',
                                commentsCount: fbPost.comments?.summary.total_count || 0,
                            },
                        },
                        upsert: true,
                    },
                }));
                if (bulkOps.length > 0) {
                    await Post.bulkWrite(bulkOps);
                    const io = (req as any).io;
                    if (io) {
                        io.to(`user_${req.user?.id}`).emit('post:received', {
                            fanpageId,
                            posts: fbPosts.map((p: any) => ({
                                postId: p.id,
                                content: p.message || '',
                                createdTime: p.created_time,
                                picture: p.full_picture || '',
                                likes: p.likes?.summary.total_count || 0,
                                shares: p.shares?.count || 0,
                                commentsCount: p.comments?.summary.total_count || 0,
                            })),
                        });
                    }
                }
                posts = await Post.find<IPost>({ fanpageId: fanpage._id })
                    .sort({ createdTime: -1 })
                    .skip((Number(page) - 1) * Number(limit))
                    .limit(Number(limit));
            }

            const total = await Post.countDocuments({ fanpageId: fanpage._id });

            res.status(200).json({
                status: 'success',
                data: {
                    posts,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                    },
                },
            });
        } catch (error: any) {
            console.error('Get posts error:', {
                message: error.message,
                stack: error.stack,
                fanpageId: req.params.fanpageId,
                userId: req.user?.id,
            });
            next(error);
        }
    }

    async createPost(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { fanpageId, content } = req.body;

            if (!fanpageId || !/^[0-9_]+$/.test(fanpageId)) {
                throw new AppError('Invalid fanpageId', 400);
            }

            if (!content || typeof content !== 'string') {
                throw new AppError('Content is required', 400);
            }

            const fanpage = await Fanpage.findOne<IFanpage>({
                pageId: fanpageId,
                userId: req.user?.id,
                isConnected: true,
            });
            if (!fanpage) {
                throw new AppError('Fanpage not found or not authorized', 404);
            }

            const fbPost = await FacebookService.createPost(fanpage.pageId, content, fanpage.accessToken);

            const post = await Post.create({
                postId: fbPost.id,
                fanpageId: fanpage._id,
                content,
                createdTime: new Date(fbPost.created_time),
                updatedTime: new Date(fbPost.created_time),
                likes: fbPost.likes?.summary.total_count || 0,
                shares: fbPost.shares?.count || 0,
                picture: fbPost.full_picture || '',
                commentsCount: fbPost.comments?.summary.total_count || 0,
            });

            const io = (req as any).io;
            if (io) {
                io.to(`user_${req.user?.id}`).emit('post:received', {
                    postId: fbPost.id,
                    fanpageId,
                    content,
                    createdTime: fbPost.created_time,
                    picture: fbPost.full_picture || '',
                    likes: fbPost.likes?.summary.total_count || 0,
                    shares: fbPost.shares?.count || 0,
                    commentsCount: fbPost.comments?.summary.total_count || 0,
                });
            }

            res.status(201).json({
                status: 'success',
                data: { post },
            });
        } catch (error: any) {
            console.error('Create post error:', {
                message: error.message,
                stack: error.stack,
                fanpageId: req.body.fanpageId,
                userId: req.user?.id,
            });
            next(error);
        }
    }

    async updatePost(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { postId } = req.params;
            const { content } = req.body;

            if (!postId || !/^[0-9a-fA-F]{24}$/.test(postId)) {
                throw new AppError('Invalid postId', 400);
            }

            if (!content || typeof content !== 'string') {
                throw new AppError('Content is required', 400);
            }

            const post = await Post.findById<IPost>(postId);
            if (!post) {
                throw new AppError('Post not found', 404);
            }

            const fanpage = await Fanpage.findById<IFanpage>(post.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Fanpage not found or not authorized', 401);
            }

            await FacebookService.updatePost(post.postId, content, fanpage.accessToken);

            post.content = content;
            post.updatedTime = new Date();
            await post.save();

            const io = (req as any).io;
            if (io) {
                io.to(`user_${req.user?.id}`).emit('post:updated', {
                    postId,
                    content,
                    updatedTime: post.updatedTime,
                });
            }

            res.status(200).json({
                status: 'success',
                data: { post },
            });
        } catch (error: any) {
            console.error('Update post error:', {
                message: error.message,
                stack: error.stack,
                postId: req.params.postId,
                userId: req.user?.id,
            });
            next(error);
        }
    }

    async deletePost(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { postId } = req.params;

            if (!postId || !/^[0-9a-fA-F]{24}$/.test(postId)) {
                throw new AppError('Invalid postId', 400);
            }

            const post = await Post.findById<IPost>(postId);
            if (!post) {
                throw new AppError('Post not found', 404);
            }

            const fanpage = await Fanpage.findById<IFanpage>(post.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Fanpage not found or not authorized', 401);
            }

            await FacebookService.deletePost(post.postId, fanpage.accessToken);

            await post.deleteOne();

            const io = (req as any).io;
            if (io) {
                io.to(`user_${req.user?.id}`).emit('post:deleted', { postId });
            }

            res.status(204).json({
                status: 'success',
                message: 'Post deleted successfully',
            });
        } catch (error: any) {
            console.error('Delete post error:', {
                message: error.message,
                stack: error.stack,
                postId: req.params.postId,
                userId: req.user?.id,
            });
            next(error);
        }
    }
}