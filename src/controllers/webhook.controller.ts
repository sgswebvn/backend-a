import { Request, Response } from 'express';
import { Server } from 'socket.io';
import { Fanpage, IFanpage } from '../models/fanpage.model';
import { Message, IMessage } from '../models/message.model';
import { Notification } from '../models/notification.model';
import { Post, IPost } from '../models/post.model';
import { Comment, IComment } from '../models/comment.model';

export class WebhookController {
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    async handleWebhook(req: Request, res: Response) {
        const { object, entry } = req.body;
        if (object !== 'page') return res.status(400).send('Invalid object');

        for (const pageEntry of entry) {
            const fanpage = await Fanpage.findOne<IFanpage>({ pageId: pageEntry.id });
            if (!fanpage) continue;

            if (pageEntry.messaging) {
                for (const event of pageEntry.messaging) {
                    if (event.message) {
                        const message = await Message.findOneAndUpdate<IMessage>(
                            { messageId: event.message.mid },
                            {
                                fanpageId: fanpage._id,
                                conversationId: event.sender.id,
                                fromId: event.sender.id,
                                fromName: event.sender.id === fanpage.pageId ? fanpage.name : 'Customer',
                                fromAvatar: event.sender.id === fanpage.pageId ? fanpage.pictureUrl || '' : '',
                                message: event.message.text,
                                createdTime: new Date(event.timestamp),
                            },
                            { upsert: true, new: true }
                        );

                        await Notification.create({
                            userId: fanpage.userId.toString(),
                            type: 'message',
                            title: 'New Message',
                            content: `New message in conversation ${event.sender.id}`,
                            relatedId: message._id.toString(),
                        });

                        this.io.to(`user_${fanpage.userId.toString()}`).emit('message:received', {
                            messageId: message.messageId,
                            fanpageId: fanpage._id.toString(),
                            conversationId: event.sender.id,
                            from: message.fromName,
                            fromAvatar: message.fromAvatar,
                            message: message.message,
                            createdTime: message.createdTime,
                        });
                    }
                }
            }

            if (pageEntry.changes) {
                for (const change of pageEntry.changes) {
                    if (change.field === 'feed') {
                        if (change.value.item === 'post') {
                            const post = await Post.findOneAndUpdate<IPost>(
                                { postId: change.value.post_id },
                                {
                                    fanpageId: fanpage._id,
                                    content: change.value.message || '',
                                    createdTime: new Date(change.value.created_time * 1000),
                                    updatedTime: new Date(change.value.updated_time * 1000),
                                    likes: change.value.likes?.summary?.total_count || 0,
                                    shares: change.value.shares?.count || 0,
                                    picture: change.value.full_picture || '',
                                    commentsCount: change.value.comments?.summary?.total_count || 0,
                                },
                                { upsert: true, new: true }
                            );

                            await Notification.create({
                                userId: fanpage.userId.toString(),
                                type: 'post',
                                title: 'New Post Activity',
                                content: `New activity on post ${change.value.post_id}`,
                                relatedId: post._id.toString(),
                            });

                            this.io.to(`user_${fanpage.userId.toString()}`).emit('post:received', {
                                postId: post.postId,
                                fanpageId: fanpage.pageId,
                                content: post.content,
                                createdTime: post.createdTime,
                                picture: post.picture,
                                likes: post.likes,
                                shares: post.shares,
                                commentsCount: post.commentsCount,
                            });
                        } else if (change.value.item === 'comment' || change.value.item === 'reply') {
                            const post = await Post.findOne<IPost>({ postId: change.value.post_id });
                            if (!post) continue;

                            const comment = await Comment.findOneAndUpdate<IComment>(
                                { commentId: change.value.comment_id },
                                {
                                    postId: post._id,
                                    fanpageId: fanpage._id,
                                    parentId: change.value.parent_id,
                                    fromId: change.value.from_id,
                                    fromName: change.value.from_name,
                                    fromAvatar: change.value.from_id === fanpage.pageId ? fanpage.pictureUrl || '' : change.value.from?.picture?.data?.url || '',
                                    message: change.value.message || '',
                                    createdTime: new Date(change.value.created_time * 1000),
                                    isHidden: change.value.is_hidden || false,
                                },
                                { upsert: true, new: true }
                            );

                            await Notification.create({
                                userId: fanpage.userId.toString(),
                                type: 'comment',
                                title: 'New Comment',
                                content: `New comment on post ${change.value.post_id}`,
                                relatedId: comment._id.toString(),
                            });

                            this.io.to(`user_${fanpage.userId.toString()}`).emit('comment:received', {
                                postId: post.postId,
                                comments: [{
                                    commentId: comment.commentId,
                                    from: comment.fromName,
                                    fromAvatar: comment.fromAvatar,
                                    message: comment.message,
                                    created_time: comment.createdTime,
                                    isHidden: comment.isHidden,
                                    parentId: comment.parentId,
                                }],
                            });
                        }
                    }
                }
            }
        }

        res.status(200).send('EVENT_RECEIVED');
    }

    static async verifyWebhook(req: Request, res: Response) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_TOKEN) {
            return res.status(200).send(challenge);
        }
        res.status(403).send('Forbidden');
    }
}