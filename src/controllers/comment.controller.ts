import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Comment } from '../models/comment.model';
import { Post } from '../models/post.model';
import { Fanpage } from '../models/fanpage.model';
import { AppError } from '../utils/error.util';
import { FacebookService } from '../services/facebook.service';

class CommentController {
    // @desc    Get comments for a post
    // @route   GET /api/comments/:postId
    // @access  Private
    async getComments(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { postId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const post = await Post.findById(postId);
            if (!post) {
                throw new AppError('Post not found', 404);
            }

            const fanpage = await Fanpage.findById(post.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Not authorized', 401);
            }

            const comments = await Comment.find({ postId })
                .sort({ createdTime: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit));

            const total = await Comment.countDocuments({ postId });

            res.status(200).json({
                status: 'success',
                data: {
                    comments,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Reply to a comment
    // @route   POST /api/comments/:commentId/reply
    // @access  Private
    async replyToComment(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { commentId } = req.params;
            const { message } = req.body;

            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new AppError('Comment not found', 404);
            }

            const fanpage = await Fanpage.findById(comment.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Not authorized', 401);
            }

            // Reply to comment using Facebook API
            const reply = await FacebookService.replyToComment(
                comment.commentId,
                message,
                fanpage.accessToken
            );

            // Save reply in database
            const newComment = await Comment.create({
                commentId: reply.id,
                postId: comment.postId,
                fanpageId: fanpage._id,
                parentId: comment.commentId,
                fromId: fanpage.pageId,
                fromName: fanpage.name,
                message: reply.message,
                createdTime: new Date(reply.created_time)
            });

            res.status(201).json({
                status: 'success',
                data: {
                    comment: newComment
                }
            });
        } catch (error) {
            next(error);
        }
    }
    async hideComment(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { commentId } = req.params;
            const comment = await Comment.findById(commentId);
            if (!comment) {
                throw new AppError('Comment not found', 404);
            }

            const fanpage = await Fanpage.findById(comment.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Not authorized', 401);
            }

            await FacebookService.hideComment(comment.commentId, fanpage.accessToken);
            comment.isHidden = true;
            await comment.save();

            res.status(200).json({
                status: 'success',
                data: { comment }
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new CommentController();
