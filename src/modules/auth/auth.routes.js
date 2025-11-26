import { Router } from 'express';
import * as controller from './auth.controller.js';
const router = Router();
router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/google', controller.startOAuth);
router.get('/callback', controller.oauthCallback);
export default router;
