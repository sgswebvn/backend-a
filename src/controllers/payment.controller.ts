import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Payment } from '../models/payment.model';
import { Package } from '../models/package.model';
import { User } from '../models/user.model';
import { AppError } from '../utils/error.util';
import { PayOSService } from '../services/payos.service';
import nodemailer from 'nodemailer';

class PaymentController {
    // @desc    Create payment for package
    // @route   POST /api/payments
    // @access  Private
    async createPayment(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { packageId } = req.body;

            // Check if package exists
            const package_ = await Package.findById(packageId);
            if (!package_) {
                throw new AppError('Package not found', 404);
            }

            // Generate unique order code
            const orderCode = `ORDER${Date.now()}${Math.floor(Math.random() * 1000)}`;

            // Create payment in database
            const payment = await Payment.create({
                userId: req.user?.id,
                packageId,
                amount: package_.price,
                status: 'pending',
                paymentMethod: 'payos',
                transactionId: orderCode
            });

            // Create payment URL with PayOS
            const paymentData = await PayOSService.createPayment(
                orderCode,
                package_.price,
                `Payment for ${package_.name} package`,
                `${process.env.CLIENT_URL}/payment/success`,
                `${process.env.CLIENT_URL}/payment/cancel`
            );

            // Update payment with URL
            payment.paymentUrl = paymentData.checkoutUrl;
            await payment.save();

            res.status(201).json({
                status: 'success',
                data: {
                    payment: {
                        id: payment._id,
                        amount: payment.amount,
                        status: payment.status,
                        paymentUrl: payment.paymentUrl
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Get user payments
    // @route   GET /api/payments
    // @access  Private
    async getPayments(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const payments = await Payment.find({ userId: req.user?.id })
                .populate('packageId')
                .sort('-createdAt');

            res.status(200).json({
                status: 'success',
                data: {
                    payments
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Handle PayOS callback
    // @route   POST /api/payments/callback
    // @access  Public
    async paymentCallback(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderCode, amount, status, signature } = req.body;

            // Verify payment signature
            const isValid = PayOSService.verifyPaymentSignature(req.body);
            if (!isValid) {
                throw new AppError('Invalid payment signature', 400);
            }

            // Find payment
            const payment = await Payment.findOne({ transactionId: orderCode });
            if (!payment) {
                throw new AppError('Payment not found', 404);
            }

            // Update payment status
            payment.status = status === 'success' ? 'completed' : 'failed';
            await payment.save();

            // If payment successful, update user's package and send email
            if (status === 'success') {
                const package_ = await Package.findById(payment.packageId);
                if (!package_) {
                    throw new AppError('Package not found', 404);
                }

                // Update user's package and expiry
                const user = await User.findById(payment.userId);
                if (user) {
                    await User.findByIdAndUpdate(payment.userId, {
                        packageId: package_._id,
                        packageExpiry: new Date(
                            Date.now() + package_.duration * 24 * 60 * 60 * 1000
                        )
                    });

                    // Configure Nodemailer
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER, // Thêm vào .env
                            pass: process.env.EMAIL_PASS  // Thêm vào .env
                        }
                    });

                    // Email options
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: user.email,
                        subject: 'Payment Successful - Package Activation',
                        text: `Dear ${user.name},\n\nYour payment of $${amount} for the ${package_.name} package has been successfully processed. Your package is now active until ${new Date(Date.now() + package_.duration * 24 * 60 * 60 * 1000).toDateString()}.\n\nThank you for using our service!\nBest regards,\nMuti Facebook Pro Team`
                    };

                    // Send email
                    await transporter.sendMail(mailOptions);
                }
            }

            res.status(200).json({
                status: 'success',
                message: 'Payment processed successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new PaymentController();
