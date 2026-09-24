const { signToken } = require("../config/jwt.config");
const userService = require("../services/userService");
const firebaseAuth = require("../config/firebase");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../config/mailer");

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
});

const removePassword = (user) => {
  if (!user) return user;
  const data = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete data.password;
  delete data.passwordResetToken;
  delete data.passwordResetExpires;
  return data;
};

// Đăng ký
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (
      !name ||
      !email ||
      !password ||
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Name, email và password là bắt buộc và phải là chuỗi ký tự",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const emailRegex = /^[^\s@]+@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.com$/i;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        message: "Email không đúng định dạng (phải có đuôi @*.com)",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password phải có ít nhất 6 ký tự",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await userService.findUserByEmail(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({
        message: "Email đã được đăng ký",
        error: "Conflict",
        statusCode: 409,
      });
    }

    const user = await userService.createUser({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });

    return res.status(201).json({
      message: "Đăng ký thành công",
      user: removePassword(user),
    });
  } catch (error) {
    next(error);
  }
};

// Đăng nhập
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      !email ||
      !password ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Email và password là bắt buộc",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await userService.findUserByEmail(normalizedEmail, true);

    if (!user) {
      return res.status(401).json({
        message: "Email hoặc mật khẩu không đúng",
        error: "Unauthorized",
        statusCode: 401,
      });
    }

    const isPasswordValid = await userService.checkPassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Email hoặc mật khẩu không đúng",
        error: "Unauthorized",
        statusCode: 401,
      });
    }

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    });

    res.cookie("token", token, getCookieOptions());

    return res.status(200).json({
      message: "Đăng nhập thành công",
      user: removePassword(user),
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });
  } catch (error) {
    next(error);
  }
};

// Lấy thông tin tài khoản hiện tại (Get Me)
const getMe = async (req, res, next) => {
  try {
    const user = await userService.findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
        error: "NotFound",
        statusCode: 404,
      });
    }

    return res.status(200).json({
      message: "Lấy thông tin thành công",
      user: removePassword(user),
    });
  } catch (error) {
    next(error);
  }
};

// Đổi mật khẩu
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (
      !oldPassword ||
      !newPassword ||
      typeof oldPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({
        message: "oldPassword và newPassword là bắt buộc và phải là chuỗi ký tự",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({
        message: "Mật khẩu mới và mật khẩu cũ không được trùng nhau",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password mới phải có ít nhất 6 ký tự",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const user = await userService.findUserById(req.user.userId, true);

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
        error: "NotFound",
        statusCode: 404,
      });
    }

    // Tài khoản không có mật khẩu (chỉ đăng nhập bằng Google OAuth)
    if (!user.password) {
      return res.status(400).json({
        message: "Tài khoản đăng nhập bằng Google không thể đổi mật khẩu theo cách này",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const isOldPasswordValid = await userService.checkPassword(oldPassword, user.password);

    if (!isOldPasswordValid) {
      return res.status(401).json({
        message: "Mật khẩu hiện tại không đúng",
        error: "Unauthorized",
        statusCode: 401,
      });
    }

    const isSameAsCurrentPassword = await userService.checkPassword(newPassword, user.password);
    if (isSameAsCurrentPassword) {
      return res.status(400).json({
        message: "Mật khẩu mới và mật khẩu cũ không được trùng nhau",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    await userService.updateUserPassword(user, newPassword);

    // Cấp token mới với tokenVersion đã được tăng
    const freshToken = signToken({
      userId: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    res.cookie("token", freshToken, getCookieOptions());

    return res.status(200).json({
      message: "Đổi mật khẩu thành công",
      token: freshToken,
    });
  } catch (error) {
    next(error);
  }
};

// Đăng xuất
const logout = async (req, res, next) => {
  try {
    if (req.user && req.user.userId) {
      await userService.revokeUserTokens(req.user.userId);
    }

    res.clearCookie("token", {
      ...getCookieOptions(),
      maxAge: 0,
    });

    return res.status(200).json({
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    next(error);
  }
};

// Lấy thông tin Admin Dashboard
const getAdminDashboard = async (req, res, next) => {
  try {
    const data = await userService.getAllUsersAndStats();
    return res.status(200).json({
      message: "Dữ liệu Admin Dashboard",
      stats: data.stats,
      users: data.users.map((u) => removePassword(u)),
    });
  } catch (error) {
    next(error);
  }
};

// Đổi vai trò (Role)
const changeRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || typeof role !== "string" || !["admin", "user"].includes(role)) {
      return res.status(400).json({
        message: "Role không hợp lệ (chỉ nhận 'admin' hoặc 'user')",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    // Không cho phép admin tự hạ quyền của chính mình
    if (req.user && (req.user.userId === id || req.user._id === id) && role !== "admin") {
      return res.status(400).json({
        message: "Bạn không thể tự hạ quyền quản trị của chính mình",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const user = await userService.findUserById(id);
    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
        error: "NotFound",
        statusCode: 404,
      });
    }

    if (user.role === role) {
      return res.status(400).json({
        message: `Người dùng này đã là ${role}`,
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const updatedUser = await userService.changeUserRole(id, role);

    return res.status(200).json({
      message: "Đổi quyền thành công",
      user: removePassword(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

// Xóa người dùng (Chỉ Admin)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Không cho phép admin tự xóa chính tài khoản đang đăng nhập
    if (req.user && (req.user.userId === id || req.user._id === id)) {
      return res.status(400).json({
        message: "Bạn không thể tự xóa tài khoản của chính mình",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const user = await userService.findUserById(id);
    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
        error: "NotFound",
        statusCode: 404,
      });
    }

    await userService.deleteUserById(id);

    return res.status(200).json({
      message: "Xóa người dùng thành công",
    });
  } catch (error) {
    next(error);
  }
};

// Đăng nhập qua Google
const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({
        message: "idToken là bắt buộc và phải là chuỗi ký tự",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    if (!firebaseAuth) {
      console.error("[Firebase Error] Backend chưa được cấu hình FIREBASE_SERVICE_ACCOUNT!");
      return res.status(500).json({
        message: "Backend chưa được cấu hình Firebase Service Account trên server (Render)",
        error: "InternalServerError",
        statusCode: 500,
      });
    }

    let decodedToken;
    try {
      decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch (err) {
      console.error("[Firebase Verify Error]:", err.code || "Verification failed");
      if (err.code === "auth/id-token-expired") {
        return res.status(401).json({
          message: "Firebase ID Token đã hết hạn",
          error: "Unauthorized",
          statusCode: 401,
        });
      }
      return res.status(401).json({
        message: "Firebase ID Token không hợp lệ",
        error: "Unauthorized",
        statusCode: 401,
      });
    }

    const { uid, email, name, picture } = decodedToken;

    if (!email) {
      return res.status(400).json({
        message: "Tài khoản Google không cung cấp email hợp lệ",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const user = await userService.findOrCreateGoogleUser({
      uid,
      email,
      name,
      picture,
    });

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    });

    res.cookie("token", token, getCookieOptions());

    return res.status(200).json({
      message: "Đăng nhập Google thành công",
      user: removePassword(user),
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });
  } catch (error) {
    next(error);
  }
};

// Quên mật khẩu
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const message = "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi";

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        message: "Email là bắt buộc và phải là chuỗi ký tự",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        message: "Email không đúng định dạng",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await userService.findUserByEmail(normalizedEmail);

    // Không tiết lộ email có tồn tại hay không.
    if (!user || user.authType === "google") {
      return res.status(200).json({ message });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const passwordResetToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const ttlMinutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 15);
    const passwordResetExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await userService.setPasswordResetToken(user, passwordResetToken, passwordResetExpires);

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (error) {
      await userService.clearPasswordResetToken(user);
      return next(error);
    }

    return res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

// Đặt lại mật khẩu
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (
      !token ||
      !newPassword ||
      typeof token !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({
        message: "token và newPassword là bắt buộc và phải là chuỗi ký tự",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password mới phải có ít nhất 6 ký tự",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const passwordResetToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    const user = await userService.findUserByResetToken(passwordResetToken);

    if (!user) {
      return res.status(400).json({
        message: "Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    await userService.resetPasswordWithHash(user, newPassword);

    res.clearCookie("token", {
      ...getCookieOptions(),
      maxAge: 0,
    });

    return res.status(200).json({ message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  getMe,
  changePassword,
  logout,
  getAdminDashboard,
  changeRole,
  deleteUser,
};