import { Request, Response } from 'express';
import { Server } from 'socket.io';
import { Fanpage } from '../models/fanpage.model';
import { Message } from '../models/message.model';
import { Notification } from '../models/notification.model';
import { Post } from '../models/post.model';

export class WebhookController {
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    async handleWebhook(req: Request, res: Response) {
        const { object, entry } = req.body;
        if (object !== 'page') return res.status(400).send('Invalid object');

        for (const pageEntry of entry) {
            const fanpage = await Fanpage.findOne({ pageId: pageEntry.id });
            if (!fanpage) continue;

            if (pageEntry.messaging) {
                for (const event of pageEntry.messaging) {
                    if (event.message) {
                        const message = await Message.create({
                            messageId: event.message.mid,
                            fanpageId: fanpage._id,
                            conversationId: event.sender.id,
                            fromId: event.sender.id,
                            fromName: 'Customer',
                            message: event.message.text,
                            createdTime: new Date(event.timestamp)
                        });

                        await Notification.create({
                            userId: fanpage.userId.toString(),
                            type: 'message',
                            title: 'New Message',
                            content: `New message in conversation ${event.sender.id}`,
                            relatedId: message._id.toString()
                        });

                        // Sử dụng this.io để phát sự kiện
                        this.io.to(`user_${fanpage.userId.toString()}`).emit('message:received', {
                            senderId: event.sender.id,
                            message: event.message.text,
                            timestamp: new Date(event.timestamp)
                        });
                    }
                }
            }

            if (pageEntry.changes) {
                for (const change of pageEntry.changes) {
                    if (change.field === 'feed' && change.value.item === 'post') {
                        await Post.findOneAndUpdate(
                            { postId: change.value.post_id },
                            {
                                fanpageId: fanpage._id,
                                content: change.value.message || '',
                                createdTime: new Date(change.value.created_time * 1000),
                                updatedTime: new Date(change.value.updated_time * 1000)
                            },
                            { upsert: true, new: true }
                        );

                        await Notification.create({
                            userId: fanpage.userId.toString(),
                            type: 'post',
                            title: 'New Post Activity',
                            content: `New activity on post ${change.value.post_id}`,
                            relatedId: change.value.post_id
                        });
                    }
                }
            }
        }

        res.status(200).send('EVENT_RECEIVED');
    }

    // Giữ verifyWebhook là static vì nó không cần io
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