const mongoose = require("mongoose");


async function connectDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("Database Connected ");
    } catch (error) {
        console.error("Mongodb Connection Error", error);
        process.exit(1)
    }
}


module.exports = connectDatabase;

