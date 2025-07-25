import axios from 'axios';
import crypto from 'crypto';
import { AppError } from '../utils/error.util';

export class PayOSService {
    private static readonly API_URL = 'https://api.payos.vn/v1';
    private static readonly CLIENT_ID = process.env.PAYOS_CLIENT_ID;
    private static readonly API_KEY = process.env.PAYOS_API_KEY;
    private static readonly CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

    private static generateSignature(data: any): string {
        const signData = `${data.orderCode}|${data.amount}|${data.description}|${data.cancelUrl}|${data.returnUrl}`;
        return crypto
            .createHmac('sha256', this.CHECKSUM_KEY!)
            .update(signData)
            .digest('hex');
    }

    static async createPayment(
        orderCode: string,
        amount: number,
        description: string,
        returnUrl: string,
        cancelUrl: string
    ) {
        try {
            const data = {
                orderCode,
                amount,
                description,
                returnUrl,
                cancelUrl,
                signature: ''
            };

            data.signature = this.generateSignature(data);

            const response = await axios.post(
                `${this.API_URL}/payment-requests`,
                data,
                {
                    headers: {
                        'x-client-id': this.CLIENT_ID,
                        'x-api-key': this.API_KEY
                    }
                }
            );

            return response.data;
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.message || 'Failed to create payment',
                error.response?.status || 500
            );
        }
    }

    static verifyPaymentSignature(data: any): boolean {
        const receivedSignature = data.signature;
        const calculatedSignature = this.generateSignature({
            orderCode: data.orderCode,
            amount: data.amount,
            description: data.description,
            cancelUrl: data.cancelUrl,
            returnUrl: data.returnUrl
        });

        return receivedSignature === calculatedSignature;
    }
}
