import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Package } from '../models/package.model';
import { User } from '../models/user.model';

dotenv.config();

const seedData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI!);
        console.log('MongoDB connected');

        // Clear existing data
        await Package.deleteMany();
        await User.deleteMany();

        // Create packages
        const packages = await Package.create([
            {
                name: 'Free',
                price: 0,
                description: 'Basic package for starters',
                features: ['1 Fanpage', 'Basic analytics', 'Comment management'],
                maxFanpages: 1,
                duration: 30 // 30 days
            },
            {
                name: 'Standard',
                price: 299000,
                description: 'Perfect for small businesses',
                features: [
                    '3 Fanpages',
                    'Advanced analytics',
                    'Comment management',
                    'Message management',
                    'Post scheduling'
                ],
                maxFanpages: 3,
                duration: 30
            },
            {
                name: 'Premium',
                price: 599000,
                description: 'For growing businesses',
                features: [
                    '10 Fanpages',
                    'Premium analytics',
                    'Comment management',
                    'Message management',
                    'Post scheduling',
                    'Auto-reply',
                    'Priority support'
                ],
                maxFanpages: 10,
                duration: 30
            }
        ]);

        // Create admin user
        await User.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'admin123',
            role: 'admin'
        });

        console.log('Data seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
