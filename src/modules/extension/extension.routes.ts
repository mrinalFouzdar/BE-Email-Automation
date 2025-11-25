import { Router } from 'express';
import * as controller from './extension.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Extension
 *   description: API endpoints for browser extension integration
 */

router.post('/process-email', controller.processEmail);

export default router;
