import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { Server } from 'socket.io';

export const createWebhookRouter = (io: Server) => {
    const router = Router();
    const webhookController = new WebhookController(io);

    router.post('/', webhookController.handleWebhook.bind(webhookController));
    router.get('/', WebhookController.verifyWebhook);

    return router;
};
