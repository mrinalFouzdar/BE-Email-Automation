import { Router } from 'express';
import * as controller from './account.controller';
const router = Router();
router.get('/', controller.listAccounts);
router.post('/', controller.createAccount);
router.get('/:id/fetch', controller.fetchAccountEmails);
router.post('/:id/label', controller.labelAccountEmails);
router.delete('/:id', controller.deleteAccount);
export default router;
