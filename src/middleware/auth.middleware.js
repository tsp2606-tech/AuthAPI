const { verifyToken } = require("../config/jwt.config");
const User = require("../models/user.model");

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // 1. Lấy token từ HttpOnly Cookie nếu có
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Fallback: Lấy token từ Authorization Header (Bearer <token>)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Không tìm thấy token xác thực",
        error: "Unauthorized",
        statusCode: 401,
      });
    }

    // 3. Verify JWT với algorithm, issuer và audience đã cấu hình
    const decoded = verifyToken(token);

    // 4. Kiểm tra user trong database và xác thực tokenVersion
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        message: "Người dùng không tồn tại hoặc tài khoản đã bị xóa",
        error: "Unauthorized",
        statusCode: 401,
      });
    }

    // Nếu tokenVersion trong token khác với tokenVersion hiện tại trong DB -> token đã bị revoke
    if (typeof decoded.tokenVersion !== "number" || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({
        message: "Phiên đăng nhập đã hết hạn hoặc token đã bị thu hồi",
        error: "Unauthorized",
        statusCode: 401,
      });
    }

    req.user = {
      userId: user._id.toString(),
      _id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn",
      error: "Unauthorized",
      statusCode: 401,
    });
  }
};

module.exports = authMiddleware;