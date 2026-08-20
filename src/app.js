const express = require("express");
const authRoutes = require("./routes/auth.routes");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();

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
        url: "http://localhost:3001",
        description: "Local Server",
      },
    ],
  },
  apis: ["./src/routes/*.js"], // Quét các comment swagger trong thư mục routes
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


app.use(express.json());
app.use("/api/auth", authRoutes);

module.exports = app;