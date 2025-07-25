import { Schema, model, Document } from 'mongoose';

export interface IPackage extends Document {
    name: string;
    price: number;
    description: string;
    features: string[];
    maxFanpages: number;
    duration: number; // Duration in days
}

const packageSchema = new Schema<IPackage>(
    {
        name: {
            type: String,
            required: true,
            unique: true
        },
        price: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        features: [{
            type: String
        }],
        maxFanpages: {
            type: Number,
            required: true
        },
        duration: {
            type: Number,
            required: true
        }
    },
    {
        timestamps: true
    }
);

export const Package = model<IPackage>('Package', packageSchema);
