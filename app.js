
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const path = require("node:path");
const connectDB = require("./config/database");
const cors = require("cors")


// Load Passport configuration
require("./config/passport");


// Import routes
const authRoutes = require("./routes/auth.routes");


const app = express();
const PORT = process.env.PORT || 3000;




// APP CONFIGURATION

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// cross - origin resource sharing
app.use(cors({
    origin: "http://localhost:5173/"
}));


// Security headers
app.use(helmet());

// Parse JSON request bodies
app.use(express.json({
    limit: "10kb"
}));

// Parse form data
app.use(express.urlencoded({
    extended: false
}));



// OAUTH SESSION CONFIGURATION
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 10 * 60 * 1000
        }

    })

);


// Initialize Passport
app.use(passport.initialize());




// BASIC ROUTES
app.get("/health", (req, res) => {

    res.json({
        message: "Food Delivery API is running"
    });

});


// EJS login page
app.get("/login", (req, res) => {

    res.render("login");

});


// API ROUTES
app.use("/api/auth", authRoutes);




// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {

    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    if (err.code === 11000) {

        return res.status(409).json({
            message: "A record with this value already exists"
        });

    }

    res.status(500).json({

        message: "Internal server error",

        error: process.env.NODE_ENV === "development"
            ? err.message
            : undefined

    });

});



// START SERVER AFTER DB CONNECTION
async function startServer() {

    try {

        await connectDB();

        app.listen(PORT, () => {

            console.log(
                `Server running at http://localhost:${PORT}`
            );

        });

    } catch (error) {

        console.error("Server startup failed:", error);

        process.exit(1);

    }

}


startServer();