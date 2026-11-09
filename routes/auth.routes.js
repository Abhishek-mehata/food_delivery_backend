const express = require('express')
const router = express.Router();

const passport = require("passport")
const authenticateUser = require("../middlewares/auth.middleware")
const {
    register,
    login,
    getMe,
    googleCallback
} = require("../controllers/auth.controller")



// NORMAL AUTHENTICATION

router.post("/register", register)
router.post("/login", login)
router.get("/me", authenticateUser, getMe)



// GOOGLE OAUTH

// step1: Redirect user to google
router.get("/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false
    })
);

// step2: Handle Google Callback
router.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false
    }),
    googleCallback
);




module.exports = router
