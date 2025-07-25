import { Schema, model, Document } from 'mongoose';

export interface INotification extends Document {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    type: 'message' | 'comment' | 'payment' | 'package_expiry';
    title: string;
    content: string;
    isRead: boolean;
    relatedId?: string; // ID của message/comment/payment liên quan
    createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['message', 'comment', 'payment', 'package_expiry'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    relatedId: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export const Notification = model<INotification>('Notification', notificationSchema);
