import { Request, Response, NextFunction } from 'express';
import { passport } from '../config/passport.js';

export const requireAuth = passport.authenticate('jwt', { session: false });

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  passport.authenticate('jwt', { session: false }, (err: any, user: any) => {
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
}
