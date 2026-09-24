const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

// Đảm bảo JWT secret được xác thực ngay khi ứng dụng khởi động
require("./config/jwt.config");

const app = express();

// Cấu hình trust proxy cho Render/Vercel (reverse proxy) để express-rate-limit nhận diện đúng client IP
app.set("trust proxy", 1);

// Tắt header nhận diện X-Powered-By
app.disable("x-powered-by");

// Bảo vệ bằng các HTTP Security Headers qua Helmet
app.use(helmet());

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://auth-fe-thaisonpham26.vercel.app",
];

if (process.env.CLIENT_URL && !allowedOrigins.includes(process.env.CLIENT_URL)) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép requests không có origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const corsError = new Error("CORS policy: Origin not allowed");
    corsError.statusCode = 403;
    return callback(corsError);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

// CSRF Protection Middleware cho cookie-based requests
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    if (req.cookies && req.cookies.token) {
      const customHeader = req.headers["x-requested-with"];
      const origin = req.headers.origin;
      const isAllowedOrigin = origin && allowedOrigins.includes(origin);

      if (customHeader !== "XMLHttpRequest" && !isAllowedOrigin) {
        return res.status(403).json({
          message: "Yêu cầu bị từ chối do bảo vệ CSRF",
          error: "Forbidden",
          statusCode: 403,
        });
      }
    }
  }
  next();
});

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Auth API Documentation",
      version: "1.0.0",
      description: "Tài liệu API cho dự án xác thực người dùng",
    },
    servers: [
      {
        url: "/",
        description: "SwaggerUI",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Nhập JWT token vào đây (không cần nhập chữ Bearer)",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use("/api/auth", authRoutes);

// Global Error Handler Middleware
const errorHandler = require("./middleware/error.middleware");
app.use(errorHandler);

module.exports = app;