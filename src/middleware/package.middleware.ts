import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { User } from '../models/user.model';
import { Fanpage } from '../models/fanpage.model';
import { IPackage } from '../models/package.model';
import { AppError } from '../utils/error.util';

export const packageMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = await User.findById(req.user?.id).populate('packageId');
        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (!user.packageId) {
            const connectedPages = await Fanpage.countDocuments({
                userId: user._id,
                isConnected: true
            });

            if (connectedPages >= 1) {
                throw new AppError(
                    'Free tier limit reached. Please upgrade your package to connect more pages',
                    403
                );
            }

            return next();
        }

        if (!user.packageExpiry || new Date(user.packageExpiry) < new Date()) {
            await User.findByIdAndUpdate(user._id, { packageId: null, packageExpiry: null });
            throw new AppError('Your package has expired. Please renew your package', 403);
        }

        const package_ = user.packageId as unknown as IPackage;
        const connectedPages = await Fanpage.countDocuments({
            userId: user._id,
            isConnected: true
        });

        if (connectedPages >= package_.maxFanpages) {
            throw new AppError(
                `Package limit reached. Your package allows maximum ${package_.maxFanpages} fanpages`,
                403
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};