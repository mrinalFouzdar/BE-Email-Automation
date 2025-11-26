import { passport } from '../config/passport.js';
export const requireAuth = passport.authenticate('jwt', { session: false });
export function optionalAuth(req, res, next) {
    passport.authenticate('jwt', { session: false }, (err, user) => {
        if (user) {
            req.user = user;
        }
        next();
    })(req, res, next);
}
