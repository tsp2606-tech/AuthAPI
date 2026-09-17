const User = require('../models/user.model');

const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        message: "Bạn không có quyền truy cập",
        error: "Forbidden",
        statusCode: 403
      });
    }

    try {
      const user = await User.findById(req.user.userId);
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          message: "Bạn không có quyền truy cập",
          error: "Forbidden",
          statusCode: 403
        });
      }
      // Cập nhật role mới nhất vào req.user để các middleware/controller khác có thể dùng
      req.user.role = user.role;
      next();
    } catch (error) {
      return res.status(500).json({
        message: "Lỗi máy chủ nội bộ",
        error: "ServerError",
        statusCode: 500
      });
    }
  };
};

module.exports = authorizeRoles;