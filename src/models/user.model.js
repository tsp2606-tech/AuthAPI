const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name là bắt buộc"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      // Bắt buộc nếu đăng nhập thường, không bắt buộc nếu dùng Google OAuth
      required: function () {
        return this.authType === "local";
      },
      minlength: [6, "Password phải có ít nhất 6 ký tự"],
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: "default.jpg",
    },
    authType: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);