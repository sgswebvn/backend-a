import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import connectDB from './config/database';
import { setupSocketIO } from './config/socket';
import { errorHandler } from './middleware/error.middleware';
import { WebhookController } from './controllers/webhook.controller';

// Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import fanpageRoutes from './routes/fanpage.routes';
import postRoutes from './routes/post.routes';
import commentRoutes from './routes/comment.routes';
import messageRoutes from './routes/message.routes';
import packageRoutes from './routes/package.routes';
import paymentRoutes from './routes/payment.routes';
import { createWebhookRouter } from './routes/webhook.routes';

import refreshUserTokens from './scripts/refreshToken';

// Load env vars
dotenv.config();

// Create Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    }
});

// Setup Socket.IO
setupSocketIO(io);

// Đăng ký WebhookController
const webhookController = new WebhookController(io);

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/fanpages', fanpageRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/payments', paymentRoutes);

app.use('/api/webhook', createWebhookRouter(io));

// Error handler
app.use(errorHandler);

// Connect to MongoDB
connectDB();
refreshUserTokens();

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});