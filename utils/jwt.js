const jwt = require("jsonwebtoken")


function createAccessToken(user) {
    try {
        return jwt.sign(
            {
                sub: user._id.toString()
            },
            process.env.JWT_SECRET,

            {
                algorithm: "HS256",
                expiresIn: process.env.JWT_EXPIRES_IN,

                issuer: "food-delivery-api",
                audience: "food-delivery-client"
            }
        )
    } catch (error) {

    }
}



// --------------------------------------------------

// Example of a non signed token
// {
//     "sub": "672123456789abcdef123456",
//     "iat": 1793970000,
//     "expiresIn": 1794056400,
//     "issuer": "food-delivery-api",
//     "audience": "food-delivery-client"
// }







// 
module.exports = {
    createAccessToken,
};