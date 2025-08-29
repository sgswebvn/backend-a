import { Schema, model, Document } from 'mongoose';

export interface IMessage extends Document {
    _id: Schema.Types.ObjectId;
    messageId: string;
    fanpageId: Schema.Types.ObjectId;
    conversationId: string;
    fromId: string;
    fromName: string;
    message?: string;
    attachments?: {
        type: string;
        url: string;
    }[];
    createdTime: Date;
    followed?: boolean;
}

const messageSchema = new Schema<IMessage>(
    {
        messageId: {
            type: String,
            required: true,
            unique: true
        },
        fanpageId: {
            type: Schema.Types.ObjectId,
            ref: 'Fanpage',
            required: true
        },
        conversationId: {
            type: String,
            required: true
        },
        fromId: {
            type: String,
            required: true
        },
        fromName: {
            type: String,
            required: true
        },
        message: String,
        attachments: [
            {
                type: {
                    type: String,
                    enum: ['photo', 'video', 'file', 'audio']
                },
                url: String
            }
        ],
        followed: {
            type: Boolean,
            default: false
        },
        createdTime: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true
    }

);

// Index for faster queries
messageSchema.index({ conversationId: 1, createdTime: -1 });

export const Message = model<IMessage>('Message', messageSchema);
