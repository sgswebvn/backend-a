import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Package } from '../models/package.model';
import { User } from '../models/user.model';
import { AppError } from '../utils/error.util';

class PackageController {
    // @desc    Get all packages
    // @route   GET /api/packages
    // @access  Public
    async getPackages(req: Request, res: Response, next: NextFunction) {
        try {
            const packages = await Package.find().sort('price');

            res.status(200).json({
                status: 'success',
                data: {
                    packages
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Get package by ID
    // @route   GET /api/packages/:id
    // @access  Public
    async getPackage(req: Request, res: Response, next: NextFunction) {
        try {
            const package_ = await Package.findById(req.params.id);

            if (!package_) {
                throw new AppError('Package not found', 404);
            }

            res.status(200).json({
                status: 'success',
                data: {
                    package: package_
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Create package (Admin only)
    // @route   POST /api/packages
    // @access  Private/Admin
    async createPackage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const user = await User.findById(req.user?.id);
            if (!user || user.role !== 'admin') {
                throw new AppError('Not authorized', 401);
            }

            const package_ = await Package.create(req.body);

            res.status(201).json({
                status: 'success',
                data: {
                    package: package_
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Update package (Admin only)
    // @route   PUT /api/packages/:id
    // @access  Private/Admin
    async updatePackage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const user = await User.findById(req.user?.id);
            if (!user || user.role !== 'admin') {
                throw new AppError('Not authorized', 401);
            }

            const package_ = await Package.findByIdAndUpdate(
                req.params.id,
                req.body,
                {
                    new: true,
                    runValidators: true
                }
            );

            if (!package_) {
                throw new AppError('Package not found', 404);
            }

            res.status(200).json({
                status: 'success',
                data: {
                    package: package_
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // @desc    Delete package (Admin only)
    // @route   DELETE /api/packages/:id
    // @access  Private/Admin
    async deletePackage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const user = await User.findById(req.user?.id);
            if (!user || user.role !== 'admin') {
                throw new AppError('Not authorized', 401);
            }

            const package_ = await Package.findById(req.params.id);

            if (!package_) {
                throw new AppError('Package not found', 404);
            }

            await package_.deleteOne();

            res.status(204).json({
                status: 'success',
                data: null
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new PackageController();
