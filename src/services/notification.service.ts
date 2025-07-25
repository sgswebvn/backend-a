import { Socket } from 'socket.io';
import { Notification, INotification } from '../models/notification.model';
import { User } from '../models/user.model';
import { Types } from 'mongoose';

export class NotificationService {
    private static userSockets: Map<string, Socket> = new Map();

    static registerUserSocket(userId: string, socket: Socket) {
        this.userSockets.set(userId, socket);

        socket.on('disconnect', () => {
            this.userSockets.delete(userId);
        });
    }

    static async createAndSendNotification(data: {
        userId: string | Types.ObjectId;
        type: INotification['type'];
        title: string;
        content: string;
        relatedId?: string;
    }) {
        try {
            const notificationCount = await Notification.countDocuments({ userId: data.userId });
            if (notificationCount >= 100) {
                await Notification.find({ userId: data.userId })
                    .sort({ createdAt: 1 })
                    .limit(notificationCount - 90)
                    .deleteMany();
            }

            const notification = await Notification.create({
                ...data,
                userId: data.userId.toString() // Chuyển ObjectId thành string
            });
            const userSocket = this.userSockets.get(data.userId.toString());
            if (userSocket) {
                userSocket.emit('notification', notification);
            }

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    static async markAsRead(notificationId: string, userId: string) {
        return Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true },
            { new: true }
        );
    }

    static async getUserNotifications(userId: string, limit = 20, page = 1) {
        return Notification.find({ userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
    }

    // Gửi thông báo sắp hết hạn gói dịch vụ
    static async sendPackageExpiryNotification(userId: string, daysLeft: number) {
        const user = await User.findById(userId);
        if (!user) return;

        await this.createAndSendNotification({
            userId,
            type: 'package_expiry',
            title: 'Sắp hết hạn gói dịch vụ',
            content: `Gói dịch vụ của bạn sẽ hết hạn trong ${daysLeft} ngày nữa. Vui lòng gia hạn để tiếp tục sử dụng dịch vụ.`
        });
    }
}
