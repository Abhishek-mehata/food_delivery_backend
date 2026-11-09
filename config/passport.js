const passport = require("passport");

const {
    Strategy: GoogleStrategy
} = require("passport-google-oauth20")

const User = require("../models/user.model")



// use(strategy: string | passport.Strategy, strategy: passport.Strategy)
passport.use(
    "google",

    // Strategy(options: StrategyOptions, verify: ((accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void) ): GoogleStrategy
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,

            // 
            state: true
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value?.trim().toLowerCase();

                // only accept a verified email
                const emailVerified = profile._json?.email_verified === true;

                if (!email || !emailVerified) {
                    return done(null, false)
                }

                // First check weather the Google account exists
                let user = await User.findOne({
                    googleId: profile.id
                });


                if (!user) {

                    // Check whether a normal account already exists
                    // with this verified email address
                    user = await User.findOne({
                        email
                    })

                    if (user) {
                        // Avoid Linking a different Google Identity
                        // to an already-linked-account

                        if (user.googleId && user.googleId !== profile.id) {
                            return done(null, false)
                        }

                        // Link Google Identity to existing account
                        user.googleId = profile.id;
                        user.isEmailVerified = true

                        if (!user.profileImageUrl) {
                            user.profileImageUrl =
                                profile.photos?.[0]?.value;
                        }
                    } else {

                        // create a new user
                        const firstName =
                            profile.name?.givenName ||
                            profile.displayName ||
                            "Google User";

                        const lastName = profile.name?.familyName || '';

                        user = await User.create({
                            firstName: firstName,
                            lastName: lastName,
                            email: email,
                            googleId: profile.id,
                            profileImageUrl: profile.photos?.[0]?.value,
                            isEmailVerified: true,
                            role: "customer"
                        });

                    }
                }

                // update last login at
                user.lastLoginAt = new Date()
                user.save()

                // passport authentication successfull
                return done(null, user)

            } catch (error) {
                done(error)
            }
        }
        
    )
)












// DEMO of a google outh profile

// {
//     id: "109876543210987654321",
//     displayName: "John Doe",
//     name: {
//         familyName: "Doe",
//         givenName: "John"
//     },

//     emails: [
//         {
//             value: "john.doe@gmail.com",
//             verified: true
//         }
//     ],

//     photos: [
//         {
//             value: "https://lh3.googleusercontent.com/a/example-profile-image"
//         }
//     ],

//     provider: "google",

//     _json: {
//         sub: "109876543210987654321",
//         name: "John Doe",
//         given_name: "John",
//         family_name: "Doe",
//         email: "john.doe@gmail.com",
//         email_verified: true,
//         picture: "https://lh3.googleusercontent.com/a/example-profile-image"
//     }
// }