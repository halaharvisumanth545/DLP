import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
});

const User = mongoose.model("User", userSchema, "users");

const query = User.findOne({
    $or: [{ email: "testUser" }, { username: "testUser" }]
});

console.log("Compiled query:");
console.log(JSON.stringify(query.getQuery(), null, 2));
