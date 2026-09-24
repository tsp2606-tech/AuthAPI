# Tài liệu API - Hệ thống Xác thực (AuthAPI)

**Base URL:** `http://localhost:3001/api/auth`
**Authentication:** 
- Hệ thống hỗ trợ xác thực qua **HttpOnly Cookie** (`token`) và Header `Authorization: Bearer <token>`.
- Đối với cookie-based request, yêu cầu kèm header `X-Requested-With: XMLHttpRequest` để bảo vệ chống tấn công CSRF.
- **Cơ chế thu hồi phiên (Token Revocation):** Sử dụng `tokenVersion`. Khi đổi mật khẩu, reset mật khẩu hoặc đăng xuất, `tokenVersion` của người dùng được tăng lên, lập tức vô hiệu hóa toàn bộ JWT cũ.
- **Xử lý mật khẩu:** Mật khẩu gửi từ Frontend qua HTTPS là mật khẩu gốc (plaintext string, tối thiểu 6 ký tự). Server thực hiện băm mật khẩu bằng thuật toán an toàn `bcryptjs` với salt rounds = 10 trước khi lưu trữ vào database.
- **Chống Brute Force (Rate Limiting):** Áp dụng giới hạn tần suất yêu cầu trên các endpoint công khai nhạy cảm. Khi vượt ngưỡng, API trả về mã lỗi `429 Too Many Requests`.

---

## 1. Đăng ký (Register)
- **Endpoint:** `/register`
- **Method:** `POST`
- **Yêu cầu xác thực:** Không
- **Rate Limit:** 5 requests / 1 giờ / IP
- **Payload (Request Body):**
  ```json
  {
    "name": "Nguyễn Văn A",
    "email": "nva@gmail.com",
    "password": "password123" // Mật khẩu gốc (>= 6 ký tự), server tự động hash bcrypt
  }
  ```
- **Responses:**
  - `201 Created` (Thành công):
    ```json
    {
      "message": "Đăng ký thành công",
      "user": {
        "_id": "6a86f...",
        "name": "Nguyễn Văn A",
        "email": "nva@gmail.com",
        "role": "user",
        "createdAt": "2026-08-20T...",
        "updatedAt": "2026-08-20T..."
      }
    }
    ```
  - `400 Bad Request`: Báo lỗi nếu thiếu thông tin, sai định dạng email (bắt buộc có đuôi `@*.com`) hoặc password < 6 ký tự.
  - `409 Conflict`: Báo lỗi nếu Email đã tồn tại trong hệ thống.
  - `429 Too Many Requests`: Vượt quá số lần cho phép từ IP.

---

## 2. Đăng nhập (Login)
- **Endpoint:** `/login`
- **Method:** `POST`
- **Yêu cầu xác thực:** Không
- **Rate Limit:** 5 requests / 15 phút / IP
- **Payload (Request Body):**
  ```json
  {
    "email": "nva@gmail.com",
    "password": "password123" // Mật khẩu gốc
  }
  ```
- **Responses:**
  - `200 OK` (Thành công): Tự động set HttpOnly Cookie `token` và trả về JSON:
    ```json
    {
      "message": "Đăng nhập thành công",
      "user": {
        "_id": "6a86f...",
        "name": "Nguyễn Văn A",
        "email": "nva@gmail.com",
        "role": "user"
      },
      "token": "eyJhbGciOiJIUz...", // Token JWT chứa userId, role, tokenVersion
      "expiresIn": "1d"
    }
    ```
  - `400 Bad Request`: Báo lỗi thiếu email hoặc mật khẩu.
  - `401 Unauthorized`: Báo lỗi sai email hoặc mật khẩu.
  - `429 Too Many Requests`: Vượt quá số lần thử đăng nhập.

---

## 3. Lấy thông tin cá nhân (Get Me)
- **Endpoint:** `/me`
- **Method:** `GET`
- **Yêu cầu xác thực:** **Có**
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Lấy thông tin thành công",
      "user": {
        "_id": "6a86f...",
        "name": "Nguyễn Văn A",
        "email": "nva@gmail.com",
        "role": "user"
      }
    }
    ```
  - `401 Unauthorized`: Token không hợp lệ, đã hết hạn hoặc đã bị thu hồi (`tokenVersion` không khớp).
  - `404 Not Found`: Không tìm thấy user trong database.

---

## 4. Đổi mật khẩu (Change Password)
- **Endpoint:** `/change-password`
- **Method:** `PUT`
- **Yêu cầu xác thực:** **Có**
- **Cơ chế:** Khi đổi mật khẩu thành công, `tokenVersion` tự động tăng. Toàn bộ các phiên đăng nhập / token cũ bị vô hiệu hóa. Client hiện tại nhận lại token mới kèm cookie cập nhật.
- **Payload (Request Body):**
  ```json
  {
    "oldPassword": "password123", // Mật khẩu cũ gốc
    "newPassword": "newpassword123" // Mật khẩu mới gốc (>= 6 ký tự)
  }
  ```
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Đổi mật khẩu thành công",
      "token": "eyJhbGci..."
    }
    ```
  - `400 Bad Request`: Báo lỗi thiếu thông tin, password mới < 6 ký tự hoặc mật khẩu mới trùng với mật khẩu cũ ("Mật khẩu mới và mật khẩu cũ không được trùng nhau").
  - `401 Unauthorized`: Báo lỗi sai mật khẩu hiện tại (oldPassword) hoặc token không hợp lệ/đã bị thu hồi.

---

## 5. Đăng xuất (Logout)
- **Endpoint:** `/logout`
- **Method:** `POST`
- **Yêu cầu xác thực:** **Có**
- **Cơ chế:** Server tăng `tokenVersion` của người dùng để vô hiệu hóa token hiện tại, đồng thời xóa HttpOnly cookie `token`.
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Đăng xuất thành công"
    }
    ```
  - `401 Unauthorized`: Chưa đăng nhập hoặc token không hợp lệ.

---

## 6. Truy cập dữ liệu Admin (Admin Dashboard)
- **Endpoint:** `/admin/dashboard`
- **Method:** `GET`
- **Yêu cầu xác thực:** **Có** (và bắt buộc user phải có `role` là `"admin"`)
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Dữ liệu Admin Dashboard",
      "stats": {
        "totalUsers": 10,
        "adminCount": 2,
        "userCount": 8
      },
      "users": [
        {
          "_id": "6a86f...",
          "name": "Nguyễn Văn A",
          "email": "nva@gmail.com",
          "role": "admin",
          "createdAt": "2026-08-20T...",
          "updatedAt": "2026-08-20T..."
        }
      ]
    }
    ```
  - `401 Unauthorized`: Token không hợp lệ hoặc đã bị thu hồi.
  - `403 Forbidden`: Người dùng không có quyền admin.

---

## 7. Thay đổi quyền truy cập (Đổi Role) - Chỉ Admin
- **Endpoint:** `/:id/role`
- **Method:** `PATCH`
- **Yêu cầu xác thực:** **Có** (và bắt buộc user phải có `role` là `"admin"`)
- **Ràng buộc:** Admin không thể tự hạ quyền của chính mình.
- **Payload (Request Body):**
  ```json
  {
    "role": "admin" // hoặc "user"
  }
  ```
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Đổi quyền thành công",
      "user": {
        "_id": "6a86f...",
        "name": "John Doe",
        "email": "john@gmail.com",
        "role": "admin"
      }
    }
    ```
  - `400 Bad Request`: Role không hợp lệ hoặc admin cố gắng tự hạ quyền của mình.
  - `403 Forbidden`: Không có quyền admin.
  - `404 Not Found`: Không tìm thấy user.

---

## 8. Xóa người dùng (Delete User) - Chỉ Admin
- **Endpoint:** `/:id`
- **Method:** `DELETE`
- **Yêu cầu xác thực:** **Có** (và bắt buộc user phải có `role` là `"admin"`)
- **Ràng buộc:** Admin không thể tự xóa chính mình.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "message": "Xóa người dùng thành công"
    }
    ```
  - `400 Bad Request`: Admin cố gắng tự xóa tài khoản của mình.
  - `401 Unauthorized`: Token không hợp lệ.
  - `403 Forbidden`: Không có quyền admin.
  - `404 Not Found`: Không tìm thấy user.

---

## 9. Đăng nhập Google (Google Login)
- **Endpoint:** `/google-login`
- **Method:** `POST`
- **Yêu cầu xác thực:** Không
- **Rate Limit:** 10 requests / 15 phút / IP
- **Payload (Request Body):**
  ```json
  {
    "idToken": "<firebase_id_token>"
  }
  ```
- **Responses:**
  - `200 OK` (Thành công): Trả về thông tin user và JWT token, kèm HttpOnly cookie.
  - `400 Bad Request`: Thiếu `idToken`.
  - `401 Unauthorized`: Firebase ID Token không hợp lệ hoặc hết hạn.
  - `429 Too Many Requests`: Vượt quá số lần gọi từ IP.

---

## 10. Quên mật khẩu (Forgot Password)
- **Endpoint:** `/forgot-password`
- **Method:** `POST`
- **Yêu cầu xác thực:** Không
- **Rate Limit:** 3 requests / 15 phút / IP
- **Payload (Request Body):**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    {
      "message": "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi"
    }
    ```
  - `400 Bad Request`: Email không đúng định dạng.
  - `429 Too Many Requests`: Vượt quá tần suất yêu cầu.

---

## 11. Đặt lại mật khẩu (Reset Password)
- **Endpoint:** `/reset-password`
- **Method:** `POST`
- **Yêu cầu xác thực:** Không
- **Rate Limit:** 5 requests / 15 phút / IP
- **Cơ chế:** Khi đặt lại mật khẩu thành công, token reset bị xóa (dùng 1 lần), `tokenVersion` tăng để hủy toàn bộ các token JWT cũ đang hoạt động.
- **Payload (Request Body):**
  ```json
  {
    "token": "<raw_reset_token>",
    "newPassword": "newpassword123" // Mật khẩu mới gốc
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    {
      "message": "Đặt lại mật khẩu thành công"
    }
    ```
  - `400 Bad Request`: Token không hợp lệ/hết hạn hoặc mật khẩu < 6 ký tự.
  - `429 Too Many Requests`: Vượt quá số lần thử.
