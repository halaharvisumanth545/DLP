import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    firstName: { type: String, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    profilePicture: { type: String }, // Can be URL or base64 string
    about: { type: String, trim: true },
    university: { type: String, trim: true },
    affiliatedCollege: { type: String, trim: true },
    course: { type: String, trim: true },
    semester: { type: String, trim: true },
    branch: { type: String, trim: true },
    countryCode: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
    role: { type: String, enum: ["student", "teacher"], default: "student" }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema, "users");
