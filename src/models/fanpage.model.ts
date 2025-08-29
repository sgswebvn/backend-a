import { Schema, model, Document } from 'mongoose';

export interface IFanpage extends Document {
    _id: Schema.Types.ObjectId;
    pageId: string;
    name: string;
    accessToken: string;
    userId: Schema.Types.ObjectId;
    category: string;
    pictureUrl: string;
    isConnected: boolean;
}

const fanpageSchema = new Schema<IFanpage>(
    {
        pageId: {
            type: String,
            required: true,
            unique: true,
        },
        name: {
            type: String,
            required: true,
        },
        accessToken: {
            type: String,
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        category: String,
        pictureUrl: String,
        isConnected: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

export const Fanpage = model<IFanpage>('Fanpage', fanpageSchema);