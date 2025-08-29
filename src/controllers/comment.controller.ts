import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Comment } from '../models/comment.model';
import { Post } from '../models/post.model';
import { Fanpage } from '../models/fanpage.model';
import { AppError } from '../utils/error.util';
import { FacebookService } from '../services/facebook.service';

class CommentController {
    async getComments(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { postId } = req.params; // postId là Facebook postId
            const { page = 1, limit = 20 } = req.query;

            if (!postId || !/^[0-9_]+$/.test(postId)) {
                throw new AppError('Invalid postId', 400);
            }

            const post = await Post.findOne({ postId });
            if (!post) {
                throw new AppError('Post not found', 404);
            }

            const fanpage = await Fanpage.findById(post.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Not authorized', 401);
            }

            let comments = await Comment.find({ postId: post._id })
                .sort({ createdTime: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit));

            if (comments.length === 0) {
                const fbComments = await FacebookService.getComments(post.postId, fanpage.accessToken);
                const commentsToInsert = fbComments.map((fbComment) => ({
                    commentId: fbComment.id,
                    postId: post._id,
                    fanpageId: fanpage._id,
                    parentId: fbComment.parent?.id,
                    fromId: fbComment.from.id,
                    fromName: fbComment.from.name,
                    fromAvatar: fbComment.from.picture?.data?.url || '',
                    message: fbComment.message || '',
                    createdTime: new Date(fbComment.created_time),
                    isHidden: fbComment.is_hidden || false,
                }));
                await Comment.insertMany(commentsToInsert);
                comments = await Comment.find({ postId: post._id })
                    .sort({ createdTime: -1 })
                    .skip((Number(page) - 1) * Number(limit))
                    .limit(Number(limit));
            }

            const total = await Comment.countDocuments({ postId: post._id });

            res.status(200).json({
                status: 'success',
                data: {
                    comments: comments.map((comment) => ({
                        ...comment.toObject(),
                        fromAvatar: comment.fromId === fanpage.pageId ? fanpage.pictureUrl : comment.fromAvatar,
                    })),
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                    },
                },
            });
        } catch (error: any) {
            console.error('Get comments error:', {
                message: error.message,
                stack: error.stack,
                postId: req.params.postId,
                userId: req.user?.id,
            });
            next(error);
        }
    }

    async replyToComment(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { commentId } = req.params;
            const { message } = req.body;

            if (!commentId || !/^[0-9a-fA-F]{24}$/.test(commentId)) {
                throw new AppError('Invalid commentId', 400);
            }

            if (!message || typeof message !== 'string') {
                throw new AppError('Message is required', 400);
            }

            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new AppError('Comment not found', 404);
            }

            const fanpage = await Fanpage.findById(comment.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Not authorized', 401);
            }

            const reply = await FacebookService.replyToComment(
                comment.commentId,
                message,
                fanpage.accessToken
            );

            const newComment = await Comment.create({
                commentId: reply.id,
                postId: comment.postId,
                fanpageId: fanpage._id,
                parentId: comment.commentId,
                fromId: fanpage.pageId,
                fromName: fanpage.name,
                fromAvatar: fanpage.pictureUrl || '',
                message: reply.message,
                createdTime: new Date(reply.created_time),
                isHidden: false,
            });

            res.status(201).json({
                status: 'success',
                data: {
                    comment: newComment,
                },
            });
        } catch (error: any) {
            console.error('Reply to comment error:', {
                message: error.message,
                stack: error.stack,
                commentId: req.params.commentId,
                userId: req.user?.id,
            });
            next(error);
        }
    }

    async hideComment(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { commentId } = req.params;
            const { hidden } = req.body;

            if (!commentId || !/^[0-9a-fA-F]{24}$/.test(commentId)) {
                throw new AppError('Invalid commentId', 400);
            }

            if (typeof hidden !== 'boolean') {
                throw new AppError('Hidden must be a boolean', 400);
            }

            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new AppError('Comment not found', 404);
            }

            const fanpage = await Fanpage.findById(comment.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Not authorized', 401);
            }

            await FacebookService.hideComment(comment.commentId, fanpage.accessToken, hidden);
            comment.isHidden = hidden;
            await comment.save();

            res.status(200).json({
                status: 'success',
                data: { comment },
            });
        } catch (error: any) {
            console.error('Hide comment error:', {
                message: error.message,
                stack: error.stack,
                commentId: req.params.commentId,
                userId: req.user?.id,
            });
            next(error);
        }
    }
}

export default new CommentController();