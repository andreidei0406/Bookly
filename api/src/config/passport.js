import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import config from './index.js';

if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, params, profile, done) => {
        try {
          const expiresIn = params.expires_in || 3600;
          const expiryDate = new Date(Date.now() + expiresIn * 1000);

          const googleData = {
            googleId: profile.id,
            email: profile.emails[0].value,
            firstName: profile.name?.givenName || profile.displayName,
            lastName: profile.name?.familyName || '',
            avatar: profile.photos?.[0]?.value || null,
            accessToken,
            refreshToken,
            expiryDate,
          };

          return done(null, googleData);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

export default passport;
