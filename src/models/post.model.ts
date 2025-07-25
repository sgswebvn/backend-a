import { Schema, model, Document } from 'mongoose';

export interface IPost extends Document {
    postId: string;
    fanpageId: Schema.Types.ObjectId;
    content: string;
    attachments: { type: string; url: string }[];
    createdTime: Date;
    updatedTime: Date;
    likes?: number;
    shares?: number;
    commentsCount?: number;
}

const postSchema = new Schema<IPost>(
    {
        likes: Number,
        shares: Number,
        commentsCount: Number,
        postId: {
            type: String,
            required: true,
            unique: true
        },
        fanpageId: {
            type: Schema.Types.ObjectId,
            ref: 'Fanpage',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        attachments: [
            {
                type: {
                    type: String,
                    enum: ['photo', 'video', 'link']
                },
                url: String
            }
        ],
        createdTime: Date,
        updatedTime: Date
    },
    {
        timestamps: true
    }

);
postSchema.index({ fanpageId: 1, postId: 1 });
export const Post = model<IPost>('Post', postSchema);
