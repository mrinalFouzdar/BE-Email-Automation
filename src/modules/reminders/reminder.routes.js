import { Router } from 'express';
import * as controller from './reminder.controller';
const router = Router();
router.get('/', controller.list);
router.post('/:id/resolve', controller.resolve);
router.post('/generate', controller.generate);
export default router;
