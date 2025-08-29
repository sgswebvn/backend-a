import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/user.model';
import { AppError } from '../utils/error.util';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateToken } from '../utils/jwt.util';
import axios, { AxiosError } from 'axios';
import jwt, { VerifyErrors } from 'jsonwebtoken';
class AuthController {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            console.log('Register request received:', req.body);
            const { email, password, name } = req.body;
            if (!email || !password || !name) {
                throw new AppError('Please provide email, password, and name', 400);
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new AppError('Invalid email format', 400);
            }
            if (password.length < 8) {
                throw new AppError('Password must be at least 8 characters', 400);
            }
            console.log('Checking if user exists');
            const userExists = await User.findOne({ email });
            if (userExists) {
                throw new AppError('User already exists', 400);
            }
            console.log('Creating user');
            const user: IUser = await User.create({
                email,
                password,
                name,
            });
            console.log('Generating token');
            const token = generateToken({
                id: user._id.toString(),
                role: user.role
            });
            res.status(201).json({
                status: 'success',
                data: {
                    user: {
                        id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    },
                    token
                }
            });
        } catch (error: any) {
            console.error('Register error:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                errors: error.errors || {}
            });
            if (error.name === 'ValidationError') {
                return next(new AppError(`Validation failed: ${error.message}`, 400));
            }
            next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            console.log('Login request received:', req.body);
            const { email, password } = req.body;
            if (!email || !password) {
                throw new AppError('Please provide email and password', 400);
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new AppError('Invalid email format', 400);
            }
            console.log('Checking user credentials');
            const user: IUser | null = await User.findOne({ email }).select('+password');
            if (!user) {
                throw new AppError('Invalid credentials: User not found', 401);
            }
            if (!(await user.comparePassword(password))) {
                throw new AppError('Invalid credentials: Incorrect password', 401);
            }
            if (!user.role) {
                console.error('User missing role:', user);
                throw new AppError('User data incomplete: Missing role', 500);
            }
            console.log('Generating token');
            const token = generateToken({
                id: user._id.toString(),
                role: user.role
            });
            res.status(200).json({
                status: 'success',
                data: {
                    user: {
                        id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    },
                    token
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            next(error);
        }
    }

    // @desc    Get current logged in user
    // @route   GET /api/auth/me
    // @access  Private
    async getMe(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const user: IUser | null = await User.findById(req.user?.id);

            if (!user) {
                throw new AppError('User not found', 404);
            }

            res.status(200).json({
                status: 'success',
                data: {
                    user: {
                        id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        facebookId: user.facebookId,
                        packageId: user.packageId,
                        packageExpiry: user.packageExpiry
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }

    async facebookCallback(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { code, state } = req.query;

            if (!code || !state) {
                throw new AppError('No authorization code or state provided', 400);
            }

            const token = decodeURIComponent(state as string);
            console.log('Facebook callback token:', token);

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
                console.log('Token verified successfully:', decoded);
            } catch (verifyError) {
                // Kiểu hóa verifyError thành VerifyErrors hoặc Error
                const error = verifyError as VerifyErrors | Error;
                console.error('Token verification error:', error.message);
                throw new AppError('Invalid or expired token', 401);
            }
            req.user = { id: decoded.id, role: decoded.role };

            const redirectUri = `${process.env.SERVER_URL}/api/auth/facebook/callback`;
            console.log('Exchanging code for access token with redirectUri:', redirectUri);

            const tokenResponse = await axios.get('https://graph.facebook.com/v23.0/oauth/access_token', {
                params: {
                    client_id: process.env.FB_APP_ID,
                    client_secret: process.env.FB_APP_SECRET,
                    redirect_uri: redirectUri,
                    code,
                },
            }).catch((error) => {
                // Kiểu hóa error thành AxiosError
                const axiosError = error as AxiosError;
                console.error('Facebook API error:', axiosError.response?.data || axiosError.message);
                throw axiosError;
            });
            const accessToken = tokenResponse.data.access_token;
            console.log('Facebook access token received:', accessToken);

            const profileResponse = await axios.get('https://graph.facebook.com/me', {
                params: {
                    fields: 'id,name,email,picture',
                    access_token: accessToken,
                },
            });
            const { id: facebookId, name, email, picture } = profileResponse.data;
            console.log('Facebook profile:', { facebookId, name, email, picture: picture?.data?.url });

            const userId = req.user?.id;
            if (!userId) throw new AppError('Unauthorized', 401);

            console.log('Updating user with id:', userId);
            const user = await User.findByIdAndUpdate(
                userId,
                {
                    facebookId,
                    facebookToken: accessToken,
                    facebookName: name,
                    facebookEmail: email,
                    facebookAvatar: picture?.data?.url,
                },
                { new: true }
            );

            if (!user) throw new AppError('User not found', 404);

            const newToken = generateToken({
                id: user._id.toString(),
                role: user.role,
            });

            const redirectUrl = `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard/fanpages?token=${encodeURIComponent(newToken)}`;
            console.log('Redirecting to:', redirectUrl);
            res.redirect(redirectUrl);
        } catch (error) {
            // Kiểu hóa error chung
            const err = error as Error | AxiosError;
            console.error('Facebook Callback Error:', err.message, err.stack);
            next(error);
        }
    }

    // @desc    Redirect to Facebook OAuth
    // @route   GET /api/auth/facebook/login
    // @access  Public
    async facebookLogin(req: Request, res: Response, next: NextFunction) {
        try {
            const token = req.query.token as string; // Nhận token từ frontend (tùy chọn)
            console.log('Facebook login token:', token); // Log token

            const redirectUri = `${process.env.SERVER_URL}/api/auth/facebook/callback`;

            const fbOAuthUrl =
                `https://www.facebook.com/v23.0/dialog/oauth?` +
                `client_id=${process.env.FB_APP_ID}` +
                `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                `&scope=email,public_profile,pages_show_list,pages_read_engagement` +
                (token ? `&state=${encodeURIComponent(token)}` : '');

            res.redirect(fbOAuthUrl);
        } catch (err) {
            console.error('Facebook login error:', err);
            next(err);
        }
    }
}

export default new AuthController();
