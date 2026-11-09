const argon2 = require("argon2");
const User = require("../models/user.model")

const { createAccessToken } = require("../utils/jwt")


// Return only safe user information
function publicUser(user) {
    return {
        id: user._id,

        firstName: user.firstName,
        lastName: user.lastName,

        email: user.email,
        phone: user.phone,
        role: user.role,

        profileImageUrl: user.profileImageUrl
    }
};


// Register User
// POST /api/auth/register
async function register(req, res, next) {
    try {
        const {
            firstName,
            lastName,
            email,
            password
        } = req.body;

        // Basic type validation
        if (
            typeof firstName !== "string" ||
            typeof lastName !== "string" ||
            typeof email !== "string" ||
            !firstName.trim() ||
            !lastName.trim()
        ) {
            return res.status(400).json({
                message: "First name, Last name, email and password are required"
            })
        }

        if (password.length < 8 || password.length > 80) {
            return res.status(400).json({
                message: "Password must be between 8 to 80 characters"
            })
        }

        const normalizeEmail = email.trim().toLocaleLowerCase()

        // check weather email already exists
        const existingUser = await User.findOne({
            email: normalizeEmail
        });


        if (existingUser) {
            return res.status(409).json({
                message: "Email already exists"
            })
        }

        // Password Hashing
        const passwrodHash = await argon2.hash(password);

        // Create the user
        const user = await User.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizeEmail,
            passwordHash: passwrodHash
            // other details are default
        });

        const accessToken = createAccessToken(user);


        return res.status(201).json({
            message: "User Registration Successful",
            token: accessToken,
            user: publicUser(user),
        });


    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "An account with this email already exists"
            });
        }

        next(error)
    }
}


// LOGIN USER
// POST /api/auth/login
async function login(req, res, next) {
    try {

        const {
            email,
            password
        } = req.body;

        if (typeof email !== "string" && typeof password !== "string") {
            return res.status(400).json({
                message: "Proper email and password are required"
            })
        };

        const normalizedEmail = email.trim().toLocaleLowerCase();

        // Find User
        // Explicitly select passwordHash because it is hidden by default
        const user = await User.findOne({
            email: normalizedEmail
        }).select("+passwordHash");

        if (!user || !user.passwordHash) {
            return res.status(401).json({
                message: "Invalid Email or password"
            })
        };

        // verify password
        const passwordMatch = await argon2.verify(
            user.passwordHash,
            password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid Email or password"
            })
        };

        if (user.status != "active") {
            return res.status(403).json({
                message: "Your account is not active"
            })
        };


        // update the login timestamp
        user.lastLoginAt = new Date();
        await user.save();


        // Generate JWT token
        const accessToken = createAccessToken(user)

        return res.status(200).json({
            message: "Login Successfull",
            token: accessToken,
            user: publicUser(user)
        })
    } catch (error) {
        next(error)
    }
}


// GET LOGGED-IN USER
// GET /api/auth/me
async function getMe(req, res, next = null) {
    try {

        if (!req.user) {
            return res.status(400).json({
                message: "Login or Register First"
            })
        }

        return res.status(200).json({
            user: publicUser(req.user)
        })
    } catch (error) {
        return res.status(400).json({
            message: "Internal Server Error"
        })
    }
}



// GOOGLE LOGIN CALLBACK
// GET /api/auth/google/callback
async function googleCallback(req, res, next) {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                message: "Google authentication failed"
            })
        }


        if (user.status != "active") {
            return res.status(403).json({
                message: "Your account is not active"
            })
        }

        const accessToken = createAccessToken(user);

        return res.status(200).json({
            message: "Google Login successful",
            token: accessToken,
            user: publicUser(user)
        });

    } catch (error) {

        next(error)

        // return res.status(500).json({
        //     message: "Internal Server Error"
        // });
    }
}


module.exports = {
    register,
    login,
    getMe,
    googleCallback
};