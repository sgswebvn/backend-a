import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.util';
import { FacebookService } from '../services/facebook.service';
import { Notification } from '../models/notification.model';
import { Message } from '../models/message.model';
import { Fanpage } from '../models/fanpage.model';

export const setupSocketIO = (io: Server) => {
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                throw new Error('Authentication error');
            }

            const decoded = verifyToken(token);
            socket.data.user = decoded;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    // Handle connection
    io.on('connection', (socket: Socket) => {
        console.log('Client connected:', socket.id);

        // Join user's room for private messages
        if (socket.data.user) {
            socket.join(`user_${socket.data.user.id}`);
        }

        // Handle message events
        socket.on('message:send', async (data) => {
            try {
                const fanpage = await Fanpage.findOne({ userId: socket.data.user.id });
                if (!fanpage) {
                    throw new Error('Fanpage not found');
                }

                // Gửi tin nhắn qua FacebookService
                const response = await FacebookService.sendMessage(
                    data.conversationId,
                    data.message,
                    fanpage.accessToken
                );

                // Lưu tin nhắn vào database
                const newMessage = await Message.create({
                    messageId: response.message_id,
                    fanpageId: fanpage._id,
                    conversationId: data.conversationId,
                    fromId: socket.data.user.id,
                    fromName: socket.data.user.name,
                    message: data.message,
                    createdTime: new Date()
                });

                // Phát tin nhắn đến người nhận
                io.to(`user_${data.recipientId}`).emit('message:received', {
                    senderId: socket.data.user.id,
                    message: data.message,
                    timestamp: new Date()
                });

                // Tạo thông báo
                await Notification.create({
                    userId: socket.data.user.id,
                    type: 'message',
                    title: 'New Message Sent',
                    content: `You sent a message in conversation ${data.conversationId}`,
                    relatedId: newMessage._id.toString()
                });
            } catch (error) {
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Handle typing events
        socket.on('typing:start', (data) => {
            io.to(`user_${data.recipientId}`).emit('typing:started', {
                senderId: socket.data.user.id
            });
        });

        socket.on('typing:stop', (data) => {
            io.to(`user_${data.recipientId}`).emit('typing:stopped', {
                senderId: socket.data.user.id
            });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};