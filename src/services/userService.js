const User = require("../models/user.model");
const bcrypt = require("bcryptjs");

const findUserByEmail = async (email, selectPassword = false) => {
  const query = User.findOne({ email: email.trim().toLowerCase() });
  if (selectPassword) {
    query.select("+password");
  }
  return await query.exec();
};

const findUserById = async (userId, selectPassword = false) => {
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
  await user.save();
  return user;
};

const checkPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPassword,
  checkPassword,
};
