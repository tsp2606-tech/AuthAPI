const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const crypto = require("crypto");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_super_secure_secret_key_at_least_32_chars_long";
process.env.CLIENT_URL = "http://localhost:5173";

// Mock mailer and firebase before importing app
jest.mock("../src/config/mailer", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../src/config/firebase", () => ({
  verifyIdToken: jest.fn(),
}));

const app = require("../src/app");
const User = require("../src/models/user.model");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  // Xóa sạch user sau mỗi test
  await User.deleteMany({});
});

describe("AuthAPI Comprehensive Security & Quality Test Suite", () => {
  // ========================================================
  // 1. Register flow
  // ========================================================
  describe("1. Register Flow", () => {
    it("should register successfully with valid inputs and send raw password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Alice",
          email: "alice@example.com",
          password: "password123",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Đăng ký thành công");
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("alice@example.com");
      expect(res.body.user.role).toBe("user");
    });

    it("should reject registration with duplicate email", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Bob", email: "bob@example.com", password: "password123" });

      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Bob 2", email: "bob@example.com", password: "password456" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Conflict");
    });

    it("should reject registration with invalid input types (NoSQL/DoS prevention)", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: 12345,
          email: { $ne: null },
          password: ["invalid", "type"],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("BadRequest");
    });

    it("should reject registration if email does not end with @*.com", async () => {
      const invalidEmails = [
        "user@example.vn",
        "user@example.org",
        "user@company.net",
        "user@com",
        "user@.com",
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post("/api/auth/register")
          .send({ name: "Invalid User", email, password: "password123" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("BadRequest");
        expect(res.body.message).toContain("@*.com");
      }
    });
  });

  // ========================================================
  // 2. Login & Rate Limit flow
  // ========================================================
  describe("2. Login & Rate Limit Flow", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Charlie", email: "charlie@example.com", password: "password123" });
    });

    it("should login successfully, set cookie and return token", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "charlie@example.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      // Kiểm tra HttpOnly Cookie được set
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
    });

    it("should reject login with wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "charlie@example.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should trigger rate limit 429 when exceeding login threshold", async () => {
      // loginLimiter max is 5 attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email: "charlie@example.com", password: "wrong" });
      }

      // 6th attempt should be blocked with 429
      const res = await request(app)
        .post("/api/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email: "charlie@example.com", password: "password123" });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe("TooManyRequests");
      expect(res.body.statusCode).toBe(429);
    });
  });

  // ========================================================
  // 3. User cannot call Admin endpoints
  // ========================================================
  describe("3. Role-Based Access Control", () => {
    it("should return 403 Forbidden when normal user calls admin dashboard", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Normal User", email: "user@example.com", password: "password123" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "user@example.com", password: "password123" });

      const token = loginRes.body.token;

      const adminRes = await request(app)
        .get("/api/auth/admin/dashboard")
        .set("Authorization", `Bearer ${token}`);

      expect(adminRes.status).toBe(403);
      expect(adminRes.body.error).toBe("Forbidden");
    });
  });

  // ========================================================
  // 4. Admin operations & Self-protection
  // ========================================================
  describe("4. Admin Operations & Self-Protection", () => {
    let adminToken;
    let adminUser;
    let targetUser;

    beforeEach(async () => {
      adminUser = await User.create({
        name: "Admin User",
        email: "admin@example.com",
        password: "hashedpassword",
        role: "admin",
        tokenVersion: 0,
      });

      targetUser = await User.create({
        name: "Target User",
        email: "target@example.com",
        password: "hashedpassword",
        role: "user",
        tokenVersion: 0,
      });

      const { signToken } = require("../src/config/jwt.config");
      adminToken = signToken({
        userId: adminUser._id.toString(),
        role: "admin",
        tokenVersion: 0,
      });
    });

    it("should allow admin to change role of another user", async () => {
      const res = await request(app)
        .patch(`/api/auth/${targetUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("admin");
    });

    it("should reject admin attempting to demote themselves", async () => {
      const res = await request(app)
        .patch(`/api/auth/${adminUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "user" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("không thể tự hạ quyền");
    });

    it("should reject admin attempting to delete themselves", async () => {
      const res = await request(app)
        .delete(`/api/auth/${adminUser._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("không thể tự xóa tài khoản");
    });

    it("should allow admin to delete another user", async () => {
      const res = await request(app)
        .delete(`/api/auth/${targetUser._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Xóa người dùng thành công");
    });
  });

  // ========================================================
  // 5. Reset Token expiration & Single-use
  // ========================================================
  describe("5. Password Reset Token Security", () => {
    it("should only allow reset token to be used once and reject expired token", async () => {
      const rawToken = "my_secure_random_reset_token_123456";
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      const user = await User.create({
        name: "Reset User",
        email: "reset@example.com",
        password: "hashedpassword",
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 mins in future
      });

      // Lần 1: Sử dụng token đặt lại mật khẩu -> Thành công
      const res1 = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: rawToken, newPassword: "newpassword123" });

      expect(res1.status).toBe(200);
      expect(res1.body.message).toBe("Đặt lại mật khẩu thành công");

      // Lần 2: Sử dụng lại cùng token -> Phải bị từ chối 400 (Single-use)
      const res2 = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: rawToken, newPassword: "anotherpassword123" });

      expect(res2.status).toBe(400);
      expect(res2.body.message).toContain("không hợp lệ hoặc đã hết hạn");

      // Test token hết hạn
      const expiredRaw = "expired_token_123456";
      const expiredHash = crypto.createHash("sha256").update(expiredRaw).digest("hex");
      await User.findByIdAndUpdate(user._id, {
        passwordResetToken: expiredHash,
        passwordResetExpires: new Date(Date.now() - 1000), // In the past
      });

      const resExpired = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: expiredRaw, newPassword: "newpassword789" });

      expect(resExpired.status).toBe(400);
      expect(resExpired.body.message).toContain("không hợp lệ hoặc đã hết hạn");
    });
  });

  // ========================================================
  // 6. Token Revocation (tokenVersion) on changePassword, resetPassword, logout
  // ========================================================
  describe("6. Token Revocation via tokenVersion", () => {
    it("should invalidate old JWT after change-password", async () => {
      // 1. Đăng ký & đăng nhập lấy Token 1
      await request(app)
        .post("/api/auth/register")
        .send({ name: "David", email: "david@example.com", password: "oldpassword123" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "david@example.com", password: "oldpassword123" });

      const token1 = loginRes.body.token;

      // 2. Dùng Token 1 đổi mật khẩu -> nhận Token 2 mới
      const changeRes = await request(app)
        .put("/api/auth/change-password")
        .set("Authorization", `Bearer ${token1}`)
        .send({ oldPassword: "oldpassword123", newPassword: "newpassword456" });

      expect(changeRes.status).toBe(200);
      const token2 = changeRes.body.token;
      expect(token2).toBeDefined();

      // 3. Sử dụng lại Token 1 cũ để gọi GET /me -> Phải bị từ chối 401
      const meOldToken = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token1}`);

      expect(meOldToken.status).toBe(401);
      expect(meOldToken.body.message).toContain("hết hạn hoặc token đã bị thu hồi");

      // 4. Sử dụng Token 2 mới -> Thành công 200
      const meNewToken = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token2}`);

      expect(meNewToken.status).toBe(200);
    });

    it("should invalidate token on logout", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Emma", email: "emma@example.com", password: "password123" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "emma@example.com", password: "password123" });

      const token = loginRes.body.token;

      // Gọi /logout với authMiddleware
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe("Đăng xuất thành công");

      // Token vừa logout gọi tiếp /me -> Phải bị từ chối 401
      const meAfterLogout = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(meAfterLogout.status).toBe(401);
    });
  });

  // ========================================================
  // 7. CORS origin blocking
  // ========================================================
  describe("7. CORS Origin Blocking", () => {
    it("should block request from unauthorized origin", async () => {
      const res = await request(app)
        .get("/api-docs")
        .set("Origin", "http://evil-attacker.com");

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("CORS policy");
    });

    it("should allow request from authorized origin", async () => {
      const res = await request(app)
        .get("/api-docs")
        .set("Origin", "http://localhost:5173");

      expect(res.status).not.toBe(403);
    });
  });

  // ========================================================
  // 8. Response Sanitization
  // ========================================================
  describe("8. Sensitive Data Response Sanitization", () => {
    it("should never expose password, passwordResetToken, or passwordResetExpires in responses", async () => {
      const regRes = await request(app)
        .post("/api/auth/register")
        .send({ name: "Frank", email: "frank@example.com", password: "password123" });

      const user = regRes.body.user;
      expect(user.password).toBeUndefined();
      expect(user.passwordResetToken).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "frank@example.com", password: "password123" });

      const loginUser = loginRes.body.user;
      expect(loginUser.password).toBeUndefined();
      expect(loginUser.passwordResetToken).toBeUndefined();
      expect(loginUser.passwordResetExpires).toBeUndefined();
    });
  });

  // ========================================================
  // 9. Google Login Avatar Sync on Matching Email
  // ========================================================
  describe("9. Google Login Avatar Sync on Matching Email", () => {
    it("should update avatar to Google picture when user registered locally then logs in with Google", async () => {
      const firebase = require("../src/config/firebase");

      // 1. Register locally with default avatar
      const regRes = await request(app)
        .post("/api/auth/register")
        .send({ name: "Grace", email: "grace@example.com", password: "password123" });

      expect(regRes.status).toBe(201);
      expect(regRes.body.user.avatar).toBe("default.jpg");

      // 2. Login with Google using the same email and a Google picture
      const googlePicture = "https://lh3.googleusercontent.com/a/google-avatar-grace.jpg";
      firebase.verifyIdToken.mockResolvedValueOnce({
        uid: "google-uid-grace-123",
        email: "grace@example.com",
        name: "Grace Google",
        picture: googlePicture,
      });

      const googleRes = await request(app)
        .post("/api/auth/google-login")
        .send({ idToken: "valid-google-id-token" });

      expect(googleRes.status).toBe(200);
      expect(googleRes.body.user.avatar).toBe(googlePicture);
      expect(googleRes.body.user.authType).toBe("google");

      // 3. Verify /me also returns the updated Google avatar
      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${googleRes.body.token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.avatar).toBe(googlePicture);
    });
  });
});
