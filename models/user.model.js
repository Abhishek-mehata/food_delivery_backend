const mongoose = require("mongoose");


// Address subdocument
const addressSchema = new mongoose.Schema({

    label: {
        type: String,
        enum: ["home", "work", "other"],
        default: "home"
    },

    line1: {
        type: String,
        required: true,
        trim: true
    },

    line2: {
        type: String,
        trim: true
    },

    city: {
        type: String,
        required: true
    },

    state: {
        type: String,
        required: true
    },

    postalCode: {
        type: String,
        required: true
    },

    country: {
        type: String,
        default: "India"
    },

    isDefault: {
        type: Boolean,
        default: false
    }

});


// Main user schema
const userSchema = new mongoose.Schema({

    firstName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60
    },

    lastName: {
        type: String,
        trim: true,
        maxlength: 60
    },

    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },

    // Never store a plain-text password
    // Google-only users may not have a password
    passwordHash: {
        type: String,
        select: false
    },

    // Google account ID
    googleId: {
        type: String,
        default: undefined
    },

    phone: {
        type: String,
        trim: true
    },

    profileImageUrl: {
        type: String
    },

    role: {
        type: String,
        enum: [
            "customer",
            "restaurant_owner",
            "delivery_partner",
            "admin"
        ],
        default: "customer"
    },

    status: {
        type: String,
        enum: ["active", "suspended"],
        default: "active"
    },

    isEmailVerified: {
        type: Boolean,
        default: false
    },

    addresses: {
        type: [addressSchema],
        default: []
    },

    lastLoginAt: {
        type: Date
    }

}, {
    timestamps: true,
    versionKey: false
});


// Database indexes
userSchema.index(
    { email: 1 },
    { unique: true }
);

userSchema.index(
    { googleId: 1 },
    { unique: true, sparse: true }
);


const User = mongoose.model("User", userSchema);

module.exports = User;