import { Router } from 'express';
import * as controller from './auth.controller';
const router = Router();

router.get('/google', controller.startOAuth);
router.get('/callback', controller.oauthCallback);

export default router;  
