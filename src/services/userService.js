const mongoose = require("mongoose");
const User = require("../models/user.model");
const bcrypt = require("bcryptjs");

const findUserByEmail = async (email, selectPassword = false) => {
  if (!email || typeof email !== "string") {
    return null;
  }
  const query = User.findOne({ email: email.trim().toLowerCase() });
  if (selectPassword) {
    query.select("+password");
  }
  return await query.exec();
};

const findUserById = async (userId, selectPassword = false) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }
  const query = User.findById(userId);
  if (selectPassword) {
    query.select("+password");
  }
  return await query.exec();
};

const createUser = async ({ name, email, password }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashedPassword,
  });
  return user;
};

const updateUserPassword = async (user, newPassword) => {
  user.password = await bcrypt.hash(newPassword, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  return user;
};

const checkPassword = async (plainPassword, hashedPassword) => {
  if (!hashedPassword) return false;
  return await bcrypt.compare(plainPassword, hashedPassword);
};

const getAllUsersAndStats = async () => {
  // Không select password để đảm bảo an toàn bảo mật
  const users = await User.find().sort({ createdAt: -1 });

  const totalUsers = users.length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const userCount = totalUsers - adminCount;

  return {
    stats: {
      totalUsers,
      adminCount,
      userCount,
    },
    users,
  };
};

const changeUserRole = async (userId, newRole) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }
  const user = await User.findById(userId);
  if (!user) {
    return null; // Không tìm thấy
  }
  user.role = newRole;
  await user.save();
  return user;
};

const deleteUserById = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }
  return await User.findByIdAndDelete(userId);
};

const findOrCreateGoogleUser = async ({ uid, email, name, picture }) => {
  const normalizedEmail = email.trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    let updated = false;
    if (!user.googleId) {
      user.googleId = uid;
      updated = true;
    }
    if (picture && user.avatar !== picture) {
      user.avatar = picture;
      updated = true;
    }
    if (user.authType !== "google") {
      user.authType = "google";
      updated = true;
    }
    if (updated) {
      await user.save();
    }
  } else {
    user = await User.create({
      name: name || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      googleId: uid,
      avatar: picture || "default.jpg",
      authType: "google",
      role: "user",
    });
  }

  return user;
};

const setPasswordResetToken = async (user, passwordResetToken, passwordResetExpires) => {
  user.passwordResetToken = passwordResetToken;
  user.passwordResetExpires = passwordResetExpires;
  await user.save({ validateBeforeSave: false });
  return user;
};

const clearPasswordResetToken = async (user) => {
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save({ validateBeforeSave: false });
  return user;
};

const findUserByResetToken = async (passwordResetToken) => {
  return await User.findOne({
    passwordResetToken,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires");
};

const resetPasswordWithHash = async (user, newPassword) => {
  user.password = await bcrypt.hash(newPassword, 10);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  return user;
};

const revokeUserTokens = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }
  return await User.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { returnDocument: "after" }
  );
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPassword,
  checkPassword,
  getAllUsersAndStats,
  changeUserRole,
  deleteUserById,
  findOrCreateGoogleUser,
  setPasswordResetToken,
  clearPasswordResetToken,
  findUserByResetToken,
  resetPasswordWithHash,
  revokeUserTokens,
};
