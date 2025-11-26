import { Router } from 'express';
import * as controller from './classify.controller';
const router = Router();
router.post('/run', controller.run);
export default router;
