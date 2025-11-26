import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcrypt';
import { userService } from '../modules/users/user.service.js';
import dotenv from 'dotenv';
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
// Local Strategy for login
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
}, async (email, password, done) => {
    try {
        const user = await userService.findByEmail(email);
        if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return done(null, false, { message: 'Invalid email or password' });
        }
        return done(null, userService.removePassword(user));
    }
    catch (error) {
        return done(error);
    }
}));
// JWT Strategy for API authentication
passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET,
}, async (jwtPayload, done) => {
    try {
        const user = await userService.findById(jwtPayload.id);
        if (!user) {
            return done(null, false);
        }
        return done(null, userService.removePassword(user));
    }
    catch (error) {
        return done(error);
    }
}));
export { passport, JWT_SECRET };
