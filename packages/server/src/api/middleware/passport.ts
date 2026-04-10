import passport from 'koa-passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = result[0];
      if (!user) return done(null, false);

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return done(null, false);

      return done(null, { id: user.id, email: user.email, displayName: user.displayName, isAdmin: user.isAdmin });
    } catch (err) {
      return done(err as Error);
    }
  }),
);

passport.serializeUser((user, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = result[0];
    if (!user) return done(null, false);
    done(null, { id: user.id, email: user.email, displayName: user.displayName, isAdmin: user.isAdmin });
  } catch (err) {
    done(err as Error);
  }
});

export const passportInit = passport.initialize();
export const passportSession = passport.session();
