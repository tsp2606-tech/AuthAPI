# Pull Request: Security Hardening, Swagger Documentation & Mailer Optimization

## 📌 Tổng quan các tính năng & cải tiến (Overview)
PR này hoàn thiện toàn bộ các yêu cầu bảo mật, tối ưu hóa hệ thống xác thực người dùng, bổ sung tài liệu Swagger OpenAPI 3.0 và cấu hình dịch vụ gửi mail qua SMTP.

---

### 1. Xử lý mật khẩu & Chuẩn bảo mật (Security Hardening)
- **Mật khẩu an toàn**: Nhận mật khẩu gốc qua HTTPS và hash an toàn bằng `bcrypt` (10 rounds) tại backend.
- **Lọc dữ liệu nhạy cảm**: Tự động loại bỏ `password`, `passwordResetToken`, `passwordResetExpires` khỏi tất cả response người dùng.
- **Chống brute force**: Bổ sung `express-rate-limit` cho các endpoint nhạy cảm (`/login`, `/register`, `/forgot-password`).
- **Thu hồi token (Token Revocation)**: Sử dụng cơ chế `tokenVersion` để vô hiệu hóa toàn bộ JWT cũ khi người dùng đổi mật khẩu hoặc đăng xuất.
- **Tự bảo vệ tài khoản Admin**: Ngăn chặn Admin tự hạ quyền (demote) hoặc tự xóa chính tài khoản của mình.
- **Kiểm tra định dạng email**: Yêu cầu email đăng ký hợp lệ và kết thúc bằng tên miền `@*.com`.

---

### 2. Tài liệu Swagger OpenAPI 3.0
- Tích hợp tài liệu Swagger UI chi tiết tại `/api-docs`.
- Khai báo đầy đủ Schemas, Request Body, Response Codes cho tất cả các endpoint:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/google-login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
  - `PUT /api/auth/change-password`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - Các endpoint quản trị (`/admin/dashboard`, `/{id}/role`, `DELETE /{id}`)

---

### 3. Cấu hình CORS & CSRF
- Hỗ trợ đầy đủ các origin hợp lệ: Localhost (`http://localhost:3000`, `http://localhost:5173`), Vercel frontend domain, và Render backend domain (`*.onrender.com`).
- Cho phép Swagger UI trên Render gọi API trực tiếp mà không bị lỗi 403 CORS.
- Tích hợp middleware kiểm tra CSRF cho cookie-based requests.

---

### 4. Dịch vụ Mailer & Quên mật khẩu (Password Reset Flow)
- Sử dụng **Nodemailer** với cổng chuẩn **587 STARTTLS** (`smtp.gmail.com`).
- Thiết lập `dns.setDefaultResultOrder('ipv4first')` nhằm triệt tiêu hoàn toàn lỗi nghẽn mạng `ENETUNREACH IPv6` trên môi trường Windows / mạng nội bộ.
- Cho phép cả tài khoản Google OAuth nhận email đặt lại mật khẩu để thiết lập mật khẩu riêng.
- Token reset mật khẩu được tạo ngẫu nhiên bằng `crypto.randomBytes(32)` và chỉ lưu bản hash SHA-256 vào database (Single-use, hết hạn sau 15 phút).

---

### 5. Kiểm thử tự động (Test Suite)
- Toàn bộ **20/20 test cases** tích hợp trong `tests/auth.test.js` đều đạt chuẩn (`PASS`).
