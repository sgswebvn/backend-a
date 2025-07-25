import { Schema, model, Document } from 'mongoose';

export interface IPayment extends Document {
    userId: Schema.Types.ObjectId;
    packageId: Schema.Types.ObjectId;
    amount: number;
    status: 'pending' | 'completed' | 'failed';
    paymentMethod: string;
    transactionId: string;
    paymentUrl?: string;
}

const paymentSchema = new Schema<IPayment>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        packageId: {
            type: Schema.Types.ObjectId,
            ref: 'Package',
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        paymentMethod: {
            type: String,
            required: true
        },
        transactionId: {
            type: String,
            required: true,
            unique: true
        },
        paymentUrl: String
    },
    {
        timestamps: true
    }
);

export const Payment = model<IPayment>('Payment', paymentSchema);
