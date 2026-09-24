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
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email không hợp lệ"],
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
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Virtual field: initials (2 ký tự in hoa)
userSchema.virtual("initials").get(function () {
  const source = (this.name && this.name.trim()) || (this.email && this.email.split("@")[0].trim()) || "US";
  const clean = source.replace(/^[^\p{L}\p{N}]+/u, "");
  const words = clean.split(/[\s\-_.]+/).filter(Boolean);

  if (words.length >= 2) {
    const first = Array.from(words[0])[0] || "";
    const second = Array.from(words[1])[0] || "";
    return (first + second).toUpperCase();
  }

  const chars = Array.from(clean);
  if (chars.length >= 2) {
    return (chars[0] + chars[1]).toUpperCase();
  }
  return (chars[0] || "U").toUpperCase();
});

userSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    return ret;
  },
});

userSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);