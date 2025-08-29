import { Schema, model, Document } from 'mongoose';

export interface IComment extends Document {
    _id: Schema.Types.ObjectId;
    commentId: string;
    postId: Schema.Types.ObjectId;
    fanpageId: Schema.Types.ObjectId;
    parentId?: string;
    fromId: string;
    fromName: string;
    message: string;
    fromAvatar?: string;
    attachments?: {
        type: string;
        url: string;
    }[];
    createdTime: Date;
    isHidden?: boolean;
}

const commentSchema = new Schema<IComment>(
    {
        commentId: {
            type: String,
            required: true,
            unique: true
        },
        postId: {
            type: Schema.Types.ObjectId,
            ref: 'Post',
            required: true
        },
        fanpageId: {
            type: Schema.Types.ObjectId,
            ref: 'Fanpage',
            required: true
        },
        parentId: String,
        fromId: {
            type: String,
            required: true
        },
        fromName: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },
        fromAvatar: {
            type: String
        },
        attachments: [
            {
                type: {
                    type: String,
                    enum: ['photo', 'video', 'sticker']
                },
                url: String
            }
        ],
        isHidden: {
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
    },

);

export const Comment = model<IComment>('Comment', commentSchema);
