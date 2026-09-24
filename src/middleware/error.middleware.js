const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.error("[Error Handler]", err.message || err);
  }

  // CORS policy rejection error
  if (err.message && err.message.includes("CORS policy")) {
    return res.status(403).json({
      message: err.message,
      error: "Forbidden",
      statusCode: 403,
    });
  }

  // Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    return res.status(409).json({
      message: "Dữ liệu đã tồn tại trong hệ thống",
      error: "Conflict",
      statusCode: 409,
    });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      message: messages.join(", "),
      error: "BadRequest",
      statusCode: 400,
    });
  }

  // CastError (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      message: "ID không hợp lệ",
      error: "BadRequest",
      statusCode: 400,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      message: "Token không hợp lệ",
      error: "Unauthorized",
      statusCode: 401,
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      message: "Token đã hết hạn",
      error: "Unauthorized",
      statusCode: 401,
    });
  }

  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  const message = err.message || "Lỗi máy chủ nội bộ";

  return res.status(statusCode).json({
    message,
    ...(err.error && { error: err.error }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
