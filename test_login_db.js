import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "./server/.env" });

const userSchema = new mongoose.Schema({
    name: String,
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    email: String,
});
const User = mongoose.model("User", userSchema, "users");

async function run() {
    try {
        const uri = process.env.MONGODB_URI;
        console.log("Connecting to:", uri);
        await mongoose.connect(uri);
        console.log("Connected.");

        const users = await User.find({}, 'email username').limit(5);
        console.log("Some users in DB:", users);

        const testUsername = "studentuser"; // Just guessing a username
        const user = await User.findOne({
            $or: [{ email: testUsername }, { username: testUsername }]
        });

        console.log("Found user with username/email:", testUsername, user);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
