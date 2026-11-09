const jwt = require("jsonwebtoken")
const User = require("../models/user.model");


async function authenticateUser(req, res, next) {
    try {

        // Read Auth Header
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(401).json({
                message: "Authorization token required"
            });
        };

        // Expected Format: 'Bearer TOKEN'
        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                message: "Invalid authorization format"
            })
        }

        const token = parts[1];

        // VERIFY JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"],
                issuer: "food-delivery-api",
                audience: "food-delivery-client"
            }
        );


        // Find the user from jwt subject
        const user = await User.findById(decoded.sub)

        if (!user || user.status !== 'active') {
            return res.status(401).json({
                message: "User not authorized"
            })
        }

        // Attach the authenticated user to request
        req.user = user;
        next()
    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token"
            })
        }
        next(error)
    }
}

module.exports = authenticateUser



// This middleware is important for 
// GET    /api/orders
// POST   /api/orders
// GET    /api/users/me
// PUT    /api/users/profile

// router.get("/me", authenticateUser, getMe);
