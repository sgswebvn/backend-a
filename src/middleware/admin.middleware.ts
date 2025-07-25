import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { User } from '../models/user.model';
import { AppError } from '../utils/error.util';

export const adminMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = await User.findById(req.user?.id);

        if (!user || user.role !== 'admin') {
            throw new AppError('Not authorized as admin', 401);
        }

        next();
    } catch (error) {
        next(error);
    }
};
