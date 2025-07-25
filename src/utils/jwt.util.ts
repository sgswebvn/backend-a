import jwt, { Secret, SignOptions, JwtPayload } from 'jsonwebtoken';
import { AppError } from './error.util';

interface TokenPayload {
    id: string;
    [key: string]: any;
}

export const generateToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new AppError('JWT_SECRET is not defined in environment variables', 500);
    }

    const options: SignOptions = {
        expiresIn: '7d'
    };

    return jwt.sign(payload, secret as Secret, options);
};

export const verifyToken = (token: string): JwtPayload => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new AppError('JWT_SECRET is not defined in environment variables', 500);
    }

    try {
        const decoded = jwt.verify(token, secret as Secret) as JwtPayload;
        return decoded;
    } catch (error) {
        throw new AppError('Invalid token', 401);
    }
};
