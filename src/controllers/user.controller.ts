import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/user.model';
import { AppError } from '../utils/error.util';

class UserController {
    // @desc    Get all users (Admin only)
    // @route   GET /api/users
    // @access  Private/Admin
    async getUsers(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // Check if admin
            const admin = await User.findById(req.user?.id);
            if (!admin || admin.role !== 'admin') {
                throw new AppError('Not authorized as admin', 401);
            }

            const users = await User.find()
                .select('-password')
                .populate('packageId')
                .sort('-createdAt');

            res.status(200).json({
                status: 'success',
                data: {
                    users
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Get user by ID (Admin only)
    // @route   GET /api/users/:id
    // @access  Private/Admin
    async getUser(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // Check if admin
            const admin = await User.findById(req.user?.id);
            if (!admin || admin.role !== 'admin') {
                throw new AppError('Not authorized as admin', 401);
            }

            const user = await User.findById(req.params.id)
                .select('-password')
                .populate('packageId');

            if (!user) {
                throw new AppError('User not found', 404);
            }

            res.status(200).json({
                status: 'success',
                data: {
                    user
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Update user (Admin only)
    // @route   PUT /api/users/:id
    // @access  Private/Admin
    async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // Check if admin
            const admin = await User.findById(req.user?.id);
            if (!admin || admin.role !== 'admin') {
                throw new AppError('Not authorized as admin', 401);
            }

            const { packageId, packageExpiry, role } = req.body;

            const user = await User.findByIdAndUpdate(
                req.params.id,
                { packageId, packageExpiry, role },
                {
                    new: true,
                    runValidators: true
                }
            ).select('-password');

            if (!user) {
                throw new AppError('User not found', 404);
            }

            res.status(200).json({
                status: 'success',
                data: {
                    user
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Delete user (Admin only)
    // @route   DELETE /api/users/:id
    // @access  Private/Admin
    async deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // Check if admin
            const admin = await User.findById(req.user?.id);
            if (!admin || admin.role !== 'admin') {
                throw new AppError('Not authorized as admin', 401);
            }

            // Don't allow admin to delete themselves
            if (req.params.id === req.user?.id) {
                throw new AppError('Admin cannot delete themselves', 400);
            }

            const user = await User.findById(req.params.id);

            if (!user) {
                throw new AppError('User not found', 404);
            }

            await user.deleteOne();

            res.status(204).json({
                status: 'success',
                data: null
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Get user statistics (Admin only)
    // @route   GET /api/users/stats
    // @access  Private/Admin
    async getUserStats(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // Check if admin
            const admin = await User.findById(req.user?.id);
            if (!admin || admin.role !== 'admin') {
                throw new AppError('Not authorized as admin', 401);
            }

            const stats = await User.aggregate([
                {
                    $facet: {
                        totalUsers: [
                            {
                                $count: 'count'
                            }
                        ],
                        activePackages: [
                            {
                                $match: {
                                    packageId: { $exists: true },
                                    packageExpiry: { $gt: new Date() }
                                }
                            },
                            {
                                $count: 'count'
                            }
                        ],
                        usersByRole: [
                            {
                                $group: {
                                    _id: '$role',
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        newUsersLastWeek: [
                            {
                                $match: {
                                    createdAt: {
                                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                                    }
                                }
                            },
                            {
                                $count: 'count'
                            }
                        ]
                    }
                }
            ]);

            res.status(200).json({
                status: 'success',
                data: {
                    stats: stats[0]
                }
            });
        } catch (error) {
            next(error);
        }
    }
    async updateNotificationPreferences(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { types } = req.body;
            const user = await User.findByIdAndUpdate(
                req.user?.id,
                { notificationPreferences: { types } },
                { new: true, runValidators: true }
            ).select('-password');

            if (!user) {
                throw new AppError('User not found', 404);
            }

            res.status(200).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new UserController();
