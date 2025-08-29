import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Message, IMessage } from '../models/message.model';
import { Fanpage, IFanpage } from '../models/fanpage.model';
import { AppError } from '../utils/error.util';
import { FacebookService } from '../services/facebook.service';

class MessageController {
    async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const fanpage = await Fanpage.findOne<IFanpage>({
                userId: req.user?.id,
                'conversations.id': conversationId,
            });

            if (!fanpage) {
                throw new AppError('Cuộc hội thoại không tìm thấy', 404);
            }

            const messages = await Message.find<IMessage>({ conversationId })
                .sort({ createdTime: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit));

            const total = await Message.countDocuments({ conversationId });

            res.status(200).json({
                status: 'success',
                data: {
                    messages: messages.map((message) => ({
                        ...message.toObject(),
                        fromAvatar: message.fromId === fanpage.pageId ? fanpage.pictureUrl || '' : message.fromAvatar || '',
                    })),
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                    },
                },
            });
        } catch (error: any) {
            console.error('Lỗi khi lấy tin nhắn:', {
                message: error.message,
                stack: error.stack,
                conversationId: req.params.conversationId,
                userId: req.user?.id,
            });
            next(error);
        }
    }

    async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;
            const { message, attachments } = req.body;

            const fanpage = await Fanpage.findOne<IFanpage>({
                userId: req.user?.id,
                'conversations.id': conversationId,
            });

            if (!fanpage) {
                throw new AppError('Cuộc hội thoại không tìm thấy', 404);
            }

            const response = await FacebookService.sendMessage(conversationId, message, fanpage.accessToken);

            const newMessage = await Message.create({
                messageId: response.message_id,
                fanpageId: fanpage._id,
                conversationId,
                fromId: fanpage.pageId,
                fromName: fanpage.name,
                fromAvatar: fanpage.pictureUrl || '',
                message,
                attachments,
                createdTime: new Date(),
            });

            const io = (req as any).io;
            if (io) {
                io.to(`user_${req.user?.id}`).emit('message:received', {
                    messageId: newMessage.messageId,
                    fanpageId: fanpage._id.toString(),
                    conversationId,
                    from: newMessage.fromName,
                    fromAvatar: newMessage.fromAvatar,
                    message: newMessage.message,
                    createdTime: newMessage.createdTime,
                });
            }

            res.status(201).json({
                status: 'success',
                data: {
                    message: newMessage,
                },
            });
        } catch (error: any) {
            console.error('Lỗi khi gửi tin nhắn:', {
                message: error.message,
                stack: error.stack,
                conversationId: req.params.conversationId,
                userId: req.user?.id,
            });
            next(error);
        }
    }

    async replyMessage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId, messageId } = req.params;
            const { message } = req.body;

            if (!conversationId || !/^[0-9_]+$/.test(conversationId)) {
                throw new AppError('conversationId không hợp lệ', 400);
            }

            if (!messageId || !/^[0-9_]+$/.test(messageId)) {
                throw new AppError('messageId không hợp lệ', 400);
            }

            if (!message || typeof message !== 'string') {
                throw new AppError('Nội dung tin nhắn là bắt buộc', 400);
            }

            const fanpage = await Fanpage.findOne<IFanpage>({
                userId: req.user?.id,
                'conversations.id': conversationId,
            });

            if (!fanpage) {
                throw new AppError('Cuộc hội thoại không tìm thấy', 404);
            }

            const parentMessage = await Message.findOne<IMessage>({ messageId });
            if (!parentMessage) {
                throw new AppError('Tin nhắn gốc không tìm thấy', 404);
            }

            const response = await FacebookService.sendMessage(conversationId, message, fanpage.accessToken);

            const newMessage = await Message.create({
                messageId: response.message_id,
                fanpageId: fanpage._id,
                conversationId,
                parentId: messageId, // Lưu ID tin nhắn gốc
                fromId: fanpage.pageId,
                fromName: fanpage.name,
                fromAvatar: fanpage.pictureUrl || '',
                message,
                createdTime: new Date(),
            });

            const io = (req as any).io;
            if (io) {
                io.to(`user_${req.user?.id}`).emit('message:received', {
                    messageId: newMessage.messageId,
                    fanpageId: fanpage._id.toString(),
                    conversationId,
                    parentId: messageId,
                    from: newMessage.fromName,
                    fromAvatar: newMessage.fromAvatar,
                    message: newMessage.message,
                    createdTime: newMessage.createdTime,
                });
            }

            res.status(201).json({
                status: 'success',
                data: {
                    message: newMessage,
                },
            });
        } catch (error: any) {
            console.error('Lỗi khi trả lời tin nhắn:', {
                message: error.message,
                stack: error.stack,
                conversationId: req.params.conversationId,
                messageId: req.params.messageId,
                userId: req.user?.id,
            });
            next(error);
        }
    }

    async followMessage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { msgId } = req.params;
            const { pageId, followed } = req.body;

            const fanpage = await Fanpage.findOne<IFanpage>({
                pageId,
                userId: req.user?.id,
                isConnected: true,
            });

            if (!fanpage) {
                throw new AppError('Fanpage không tìm thấy hoặc không được ủy quyền', 404);
            }

            const message = await Message.findOne<IMessage>({
                _id: msgId,
                fanpageId: fanpage._id,
            });

            if (!message) {
                throw new AppError('Tin nhắn không tìm thấy', 404);
            }

            message.followed = followed;
            await message.save();

            const io = (req as any).io;
            if (io) {
                io.to(`user_${req.user?.id}`).emit('message:followed', {
                    messageId: msgId,
                    followed,
                });
            }

            res.status(200).json({
                status: 'success',
                data: {
                    message,
                },
            });
        } catch (error: any) {
            console.error('Lỗi khi theo dõi tin nhắn:', {
                message: error.message,
                stack: error.stack,
                msgId: req.params.msgId,
                userId: req.user?.id,
            });
            next(error);
        }
    }
}

export default new MessageController();