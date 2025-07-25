import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();

router.post('/', WebhookController.handleWebhook);
router.get('/', WebhookController.verifyWebhook);

export default router;