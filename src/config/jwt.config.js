const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "test" ? "test_secret_key_at_least_32_characters_long_for_security" : undefined);

if (!JWT_SECRET) {
  throw new Error("FATAL ERROR: JWT_SECRET environment variable is not defined!");
}

if (process.env.NODE_ENV === "production" && JWT_SECRET.length < 32) {
  throw new Error("FATAL ERROR: JWT_SECRET must be at least 32 characters long in production!");
}

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "AuthAPI";
const JWT_AUDIENCE = "AuthClient";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

const signToken = (payload, options = {}) => {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: JWT_EXPIRES_IN,
    ...options,
  });
};

const verifyToken = (token, options = {}) => {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    ...options,
  });
};

module.exports = {
  JWT_SECRET,
  JWT_ALGORITHM,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_EXPIRES_IN,
  signToken,
  verifyToken,
};
