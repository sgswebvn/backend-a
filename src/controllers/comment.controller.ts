import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Comment, IComment } from '../models/comment.model';
import { Post, IPost } from '../models/post.model';
import { Fanpage, IFanpage } from '../models/fanpage.model';
import { AppError } from '../utils/error.util';
import { FacebookService } from '../services/facebook.service';

class CommentController {
    async getComments(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { postId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            if (!postId || !/^[0-9_]+$/.test(postId)) {
                throw new AppError('postId không hợp lệ', 400);
            }

            const post = await Post.findOne<IPost>({ postId });
            if (!post) {
                throw new AppError('Bài đăng không tìm thấy', 404);
            }

            const fanpage = await Fanpage.findById<IFanpage>(post.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Không được ủy quyền', 401);
            }

            let comments = await Comment.find<IComment>({ postId: post._id })
                .sort({ createdTime: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit));

            if (comments.length === 0) {
                const fbComments = await FacebookService.getComments(post.postId, fanpage.accessToken);
                const bulkOps = fbComments.map((fbComment: { id: string; message: string; created_time: string; from: { id: string; name: string; picture?: { data: { url: string } } }; parent?: { id: string }; is_hidden?: boolean }) => ({
                    updateOne: {
                        filter: { commentId: fbComment.id },
                        update: {
                            $set: {
                                postId: post._id,
                                fanpageId: fanpage._id,
                                parentId: fbComment.parent?.id,
                                fromId: fbComment.from.id,
                                fromName: fbComment.from.name,
                                fromAvatar: fbComment.from.picture?.data?.url || '',
                                message: fbComment.message || '',
                                createdTime: new Date(fbComment.created_time),
                                isHidden: fbComment.is_hidden || false,
                            },
                        },
                        upsert: true,
                    },
                }));
                if (bulkOps.length > 0) {
                    await Comment.bulkWrite(bulkOps);
                    const io = (req as any).io;
                    if (io) {
                        io.to(`user_${req.user?.id}`).emit('comment:received', {
                            postId,
                            comments: fbComments.map((c: any) => ({
                                commentId: c.id,
                                from: c.from.name,
                                fromAvatar: c.from.picture?.data?.url || '',
                                message: c.message,
                                created_time: c.created_time,
                                isHidden: c.is_hidden || false,
                                parentId: c.parent?.id,
                            })),
                        });
                    }
                }
                comments = await Comment.find<IComment>({ postId: post._id })
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
                        fromAvatar: comment.fromId === fanpage.pageId ? fanpage.pictureUrl || 'https://via.placeholder.com/32' : comment.fromAvatar || 'https://via.placeholder.com/32',
                    })),
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                    },
                },
            });
        } catch (error: any) {
            console.error('Lỗi khi lấy bình luận:', {
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

            if (!commentId || !/^[0-9_]+$/.test(commentId)) {
                throw new AppError('commentId không hợp lệ', 400);
            }

            if (!message || typeof message !== 'string') {
                throw new AppError('Nội dung bình luận là bắt buộc', 400);
            }

            const comment = await Comment.findOne<IComment>({ commentId });
            if (!comment) {
                throw new AppError('Bình luận không tìm thấy', 404);
            }

            const fanpage = await Fanpage.findById<IFanpage>(comment.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Không được ủy quyền', 401);
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
                fromAvatar: fanpage.pictureUrl || 'https://via.placeholder.com/32',
                message: reply.message,
                createdTime: new Date(reply.created_time),
                isHidden: false,
            });

            const io = (req as any).io;
            if (io) {
                io.to(`user_${req.user?.id}`).emit('comment:received', {
                    postId: comment.postId,
                    comments: [{
                        commentId: reply.id,
                        from: fanpage.name,
                        fromAvatar: fanpage.pictureUrl || 'https://via.placeholder.com/32',
                        message: reply.message,
                        created_time: reply.created_time,
                        isHidden: false,
                        parentId: comment.commentId,
                    }],
                });
            }

            res.status(201).json({
                status: 'success',
                data: {
                    comment: newComment,
                },
            });
        } catch (error: any) {
            console.error('Lỗi khi trả lời bình luận:', {
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

            if (!commentId || !/^[0-9_]+$/.test(commentId)) {
                throw new AppError('commentId không hợp lệ', 400);
            }

            if (typeof hidden !== 'boolean') {
                throw new AppError('Hidden phải là giá trị boolean', 400);
            }

            const comment = await Comment.findOne<IComment>({ commentId });
            if (!comment) {
                throw new AppError('Bình luận không tìm thấy', 404);
            }

            const fanpage = await Fanpage.findById<IFanpage>(comment.fanpageId);
            if (!fanpage || fanpage.userId.toString() !== req.user?.id) {
                throw new AppError('Không được ủy quyền', 401);
            }

            await FacebookService.hideComment(comment.commentId, fanpage.accessToken, hidden);
            comment.isHidden = hidden;
            await comment.save();

            const io = (req as any).io;
            if (io) {
                io.to(`user_${req.user?.id}`).emit('comment:updated', {
                    commentId: comment.commentId,
                    hidden,
                });
            }

            res.status(200).json({
                status: 'success',
                data: { comment },
            });
        } catch (error: any) {
            console.error('Lỗi khi ẩn bình luận:', {
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