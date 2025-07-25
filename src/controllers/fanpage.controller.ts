import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/user.model';
import { Fanpage } from '../models/fanpage.model';
import { Package, IPackage } from '../models/package.model';
import { FacebookService } from '../services/facebook.service';
import { AppError } from '../utils/error.util';

export class FanpageController {
    async connectFanpage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { pageId } = req.body;
            const user = await User.findById(req.user?.id).populate('packageId');
            if (!user?.facebookToken) {
                throw new AppError('Please connect your Facebook account first', 400);
            }

            const existingFanpage = await Fanpage.findOne({ pageId });
            if (existingFanpage) {
                throw new AppError('Fanpage already connected', 400);
            }

            const connectedPages = await Fanpage.countDocuments({ userId: req.user?.id });
            const maxFanpages = user.packageId
                ? (user.packageId as unknown as IPackage).maxFanpages
                : 1;
            if (connectedPages >= maxFanpages) {
                throw new AppError(
                    `You can only connect up to ${maxFanpages} fanpages. Please upgrade your package.`,
                    400
                );
            }

            const pageDetails = await FacebookService.getPageDetails(pageId, user.facebookToken);
            const fanpage = await Fanpage.create({
                pageId: pageDetails.id,
                name: pageDetails.name,
                accessToken: pageDetails.access_token,
                userId: req.user?.id,
                category: pageDetails.category,
                pictureUrl: pageDetails.picture?.data?.url
            });

            await FacebookService.syncPageData(pageDetails.id, pageDetails.access_token);

            res.status(201).json({
                status: 'success',
                data: { fanpage }
            });
        } catch (error) {
            next(error);
        }
    }

    async disconnectFanpage(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { fanpageId } = req.params;
            const fanpage = await Fanpage.findOne({ _id: fanpageId, userId: req.user?.id });
            if (!fanpage) {
                throw new AppError('Fanpage not found or not authorized', 404);
            }

            fanpage.isConnected = false;
            await fanpage.save();

            res.status(200).json({
                status: 'success',
                message: 'Fanpage disconnected successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    async refreshFanpageToken(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { fanpageId } = req.params;
            const fanpage = await Fanpage.findById(fanpageId);
            if (!fanpage) {
                throw new AppError('Fanpage not found', 404);
            }

            const user = await User.findById(req.user?.id).populate('packageId');
            if (!user?.facebookToken) {
                throw new AppError('User not found or Facebook account not connected', 404);
            }

            const updatedFanpage = await FacebookService.refreshPageAccessToken(
                fanpage.pageId,
                user.facebookToken
            );

            res.status(200).json({
                status: 'success',
                data: { fanpage: updatedFanpage }
            });
        } catch (error) {
            next(error);
        }
    }
}