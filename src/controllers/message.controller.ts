import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Message } from '../models/message.model';
import { Fanpage } from '../models/fanpage.model';
import { AppError } from '../utils/error.util';
import { FacebookService } from '../services/facebook.service';

class MessageController {
    // @desc    Get conversation messages
    // @route   GET /api/messages/:conversationId
    // @access  Private
    async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            // Find fanpage and check ownership
            const fanpage = await Fanpage.findOne({
                userId: req.user?.id,
                'conversations.id': conversationId
            });

            if (!fanpage) {
                throw new AppError('Conversation not found', 404);
            }

            // Get messages
            const messages = await Message.find({ conversationId })
                .sort({ createdTime: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit));

            const total = await Message.countDocuments({ conversationId });

            res.status(200).json({
                status: 'success',
                data: {
                    messages,
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

    // @desc    Send message
    // @route   POST /api/messages/:conversationId
    // @access  Private
    async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;
            const { message, attachments } = req.body;

            // Find fanpage and check ownership
            const fanpage = await Fanpage.findOne({
                userId: req.user?.id,
                'conversations.id': conversationId
            });

            if (!fanpage) {
                throw new AppError('Conversation not found', 404);
            }

            // Send message through Facebook
            const response = await FacebookService.sendMessage(
                conversationId,
                message,
                fanpage.accessToken
            );

            // Save message to database
            const newMessage = await Message.create({
                messageId: response.message_id,
                fanpageId: fanpage._id,
                conversationId,
                fromId: fanpage.pageId,
                fromName: fanpage.name,
                message,
                attachments,
                createdTime: new Date()
            });

            res.status(201).json({
                status: 'success',
                data: {
                    message: newMessage
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new MessageController();
