const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const userService = require("../services/userService");
const firebaseAuth = require("../config/firebase");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../config/mailer");
const removePassword = (user) => {
  const data = user.toObject();
  // Giữ nguyên trường password (đã là hash bcrypt) để trả về
  return data;
};

//ham register
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email và password là bắt buộc",
        error: "BadRequest",
        statusCode: 400
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password phải có ít nhất 6 ký tự",
        error: "BadRequest",
        statusCode: 400
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email đã được đăng ký",
        error: "Conflict",
        statusCode: 409
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    return res.status(201).json({
      message: "Đăng ký thành công",
      user: removePassword(user)
    });
  } catch (error) {
    next(error);
  }
};

//ham login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email và password là bắt buộc",
        error: "BadRequest",
        statusCode: 400
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      email: normalizedEmail
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Email hoặc mật khẩu không đúng",
        error: "Unauthorized",
        statusCode: 401
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Email hoặc mật khẩu không đúng",
        error: "Unauthorized",
        statusCode: 401
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    return res.status(200).json({
      message: "Đăng nhập thành công",
      user: removePassword(user),
      token,
      expiresIn: "1d"
    });
  } catch (error) {
    next(error);
  }
};

//get me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
        error: "NotFound",
        statusCode: 404
      });
    }

    return res.status(200).json({
      message: "Lấy thông tin thành công",
      user: removePassword(user)
    });
  } catch (error) {
    next(error);
  }
};

//ham change password
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "oldPassword và newPassword là bắt buộc",
        error: "BadRequest",
        statusCode: 400
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password mới phải có ít nhất 6 ký tự",
        error: "BadRequest",
        statusCode: 400
      });
    }

    const user = await User.findById(req.user.userId)
      .select("+password");

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
        error: "NotFound",
        statusCode: 404
      });
    }

    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.password
    );

    if (!isOldPasswordValid) {
      return res.status(401).json({
        message: "Mật khẩu hiện tại không đúng",
        error: "Unauthorized",
        statusCode: 401
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      message: "Đổi mật khẩu thành công"
    });
  } catch (error) {
    next(error);
  }
};

//ham logout
const logout = async (req, res) => {
  return res.status(200).json({
    message: "Đăng xuất thành công"
  });
};

//ham admin dashboard
const getAdminDashboard = async (req, res, next) => {
  try {
    const data = await userService.getAllUsersAndStats();
    return res.status(200).json({
      message: "Dữ liệu Admin Dashboard",
      ...data
    });
  } catch (error) {
    next(error);
  }
};

//ham doi role
const changeRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !["admin", "user"].includes(role)) {
      return res.status(400).json({
        message: "Role không hợp lệ (chỉ nhận 'admin' hoặc 'user')",
        error: "BadRequest",
        statusCode: 400
      });
    }

    const user = await userService.findUserById(id);
    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
        error: "NotFound",
        statusCode: 404
      });
    }

    if (user.role === role) {
      return res.status(400).json({
        message: `Người dùng này đã là ${role}`,
        error: "BadRequest",
        statusCode: 400
      });
    }

    const updatedUser = await userService.changeUserRole(id, role);

    return res.status(200).json({
      message: "Đổi quyền thành công",
      user: removePassword(updatedUser)
    });
  } catch (error) {
    next(error);
  }
};

//login google
const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        message: "idToken là bắt buộc",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    // 1. Xác thực ID Token qua Firebase Admin SDK
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
      console.error("[Firebase Verify Error]:", err);
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

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Tìm User trong Database
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      // Nếu đã có tài khoản: cập nhật thêm googleId/avatar nếu trước đó đăng ký local
      let updated = false;
      if (!user.googleId) {
        user.googleId = uid;
        updated = true;
      }
      if (picture && user.avatar === "default.jpg") {
        user.avatar = picture;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    } else {
      // 3. Nếu chưa có tài khoản: tạo User mới với authType = 'google'
      user = await User.create({
        name: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        googleId: uid,
        avatar: picture || "default.jpg",
        authType: "google",
        role: "user",
      });
    }

    // 4. Ký JWT của hệ thống (dùng chung quy ước với login thường)
    const expiresIn = process.env.JWT_EXPIRES_IN || "1d";
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn },
    );

    return res.status(200).json({
      message: "Đăng nhập Google thành công",
      user: removePassword(user),
      token,
      expiresIn,
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const message = "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi";

    if (!email) {
      return res.status(400).json({
        message: "Email là bắt buộc",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

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

    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (error) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save({ validateBeforeSave: false });
      return next(error);
    }

    return res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "token và newPassword là bắt buộc",
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
    const user = await User.findOne({
      passwordResetToken,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      return res.status(400).json({
        message: "Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
        error: "BadRequest",
        statusCode: 400,
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

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
};