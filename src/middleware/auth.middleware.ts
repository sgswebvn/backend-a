import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/error.util';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

export const authMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            throw new AppError('No authentication token', 401);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            id: string;
            role: string;
        };

        req.user = decoded;
        next();
    } catch (error) {
        next(new AppError('Authentication failed', 401));
    }
};
