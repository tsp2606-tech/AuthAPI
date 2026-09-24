const rateLimit = require("express-rate-limit");

const createLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    limit: options.max || options.limit || 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"],
    handler: (req, res) => {
      return res.status(429).json({
        message: options.message || "Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau.",
        error: "TooManyRequests",
        statusCode: 429,
      });
    },
    ...options,
  });
};

const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau 15 phút.",
});

const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Quá nhiều tài khoản được đăng ký từ IP này. Vui lòng thử lại sau 1 giờ.",
});

const forgotPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  message: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 15 phút.",
});

const resetPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 15 phút.",
});

const googleLoginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Quá nhiều yêu cầu đăng nhập Google. Vui lòng thử lại sau 15 phút.",
});

module.exports = {
  createLimiter,
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  googleLoginLimiter,
};
