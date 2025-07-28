import cron from 'node-cron';
import { User } from '../models/user.model';
import { FacebookService } from '../services/facebook.service';
import { AppError } from '../utils/error.util';

const refreshUserTokens = async () => {
    try {
        const users = await User.find({ facebookToken: { $exists: true } });

        for (const user of users) {
            // Giả định token hết hạn sau 60 ngày (theo Facebook OAuth)
            const tokenExpiry = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000); // Kiểm tra 10 ngày trước khi hết hạn
            if (user.facebookToken && new Date(user.updatedAt) < tokenExpiry) {
                const newTokenData = await FacebookService.refreshUserAccessToken(user.facebookToken);
                await User.findByIdAndUpdate(user._id, {
                    facebookToken: newTokenData.access_token,
                    updatedAt: new Date()
                });
                console.log(`Refreshed token for user ${user._id}`);
            }
        }
    } catch (error) {
        console.error('Error refreshing tokens:', error);
    }
};

// Chạy mỗi ngày một lần vào 2h sáng
cron.schedule('0 2 * * *', refreshUserTokens);

export default refreshUserTokens;