import { Router } from 'express';
import * as controller from './email.controller';
const router = Router();

router.get('/fetch', controller.fetch);
router.get('/', controller.list);
router.get('/:id/meta', controller.getEmailMeta);

export default router;
