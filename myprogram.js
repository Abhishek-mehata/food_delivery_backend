
    new GoogleStrategy(

        {

            clientID: process.env.GOOGLE_CLIENT_ID,

            clientSecret: process.env.GOOGLE_CLIENT_SECRET,

            callbackURL: process.env.GOOGLE_CALLBACK_URL,

            // Protect the OAuth flow against request forgery
            state: true

        },


        async (accessToken, refreshToken, profile, done) => {

            try {

                // Extract Google email
                const email = profile.emails?.[0]?.value
                    ?.trim()
                    .toLowerCase();

                // Only accept a verified Google email
                const emailVerified =
                    profile._json?.email_verified === true;

                if (!email || !emailVerified) {
                    return done(null, false);
                }

                // First, check whether this Google account exists
                let user = await User.findOne({
                    googleId: profile.id
                });


                if (!user) {
                    // Check whether a normal account already exists
                    // with this verified email address
                    user = await User.findOne({
                        email
                    });

                    if (user) {
                        // Avoid linking a different Google identity
                        // to an already-linked user account
                        if (
                            user.googleId &&
                            user.googleId !== profile.id
                        ) {
                            return done(null, false);
                        }

                        // Link Google identity to existing account
                        user.googleId = profile.id;
                        user.isEmailVerified = true;

                        if (!user.profileImageUrl) {
                            user.profileImageUrl =
                                profile.photos?.[0]?.value;
                        }
                    } else {

                        // Create a new user
                        const firstName =
                            profile.name?.givenName ||
                            profile.displayName ||
                            "Google User";

                        const lastName =
                            profile.name?.familyName || "";

                        user = await User.create({
                            firstName,
                            lastName,
                            email,
                            googleId: profile.id,
                            profileImageUrl:
                                profile.photos?.[0]?.value,
                            isEmailVerified: true,
                            role: "customer"
                        });
                    }
                }
                // Update last login
                user.lastLoginAt = new Date();
                await user.save();

                // Passport authentication successful
                return done(null, user);

            } catch (error) {
                return done(error);
            }
        }
    )
