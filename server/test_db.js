import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./models/User.js";

dotenv.config();

async function run() {
    try {
        const uri = process.env.MONGODB_URI;
        console.log("Connecting to:", uri);
        await mongoose.connect(uri);
        console.log("Connected.");

        // create a fake test user
        const usernameTest = "testing123";
        try {
            await User.create({
                name: "Test User",
                email: "test_db_user12@example.com",
                username: usernameTest,
                passwordHash: "fakehash",
                role: "student"
            });
            console.log("Created test user");
        } catch (e) {
            console.log("Creation error or exists:", e.message);
        }

        const start = Date.now();
        const identifier = usernameTest.toLowerCase();
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }]
        });

        console.log("Found user with username/email:", identifier);
        console.log(user);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
