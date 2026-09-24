# Tài liệu API - Hệ thống Xác thực (AuthAPI)

**Base URL:** `http://localhost:3001/api/auth`
**Authentication:** Các route yêu cầu xác thực cần gửi Header `Authorization: Bearer <token>`

---

## 1. Đăng ký (Register)
- **Endpoint:** `/register`
- **Method:** `POST`
- **Yêu cầu xác thực:** Không
- **Payload (Request Body):**
  ```json
  {
    "name": "Nguyễn Văn A",
    "email": "nva@gmail.com",
    "password": "password123" // Yêu cầu >= 6 ký tự
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
  - `400 Bad Request`: Báo lỗi nếu thiếu thông tin hoặc password < 6 ký tự.
  - `409 Conflict`: Báo lỗi nếu Email đã tồn tại trong hệ thống.

---

## 2. Đăng nhập (Login)
- **Endpoint:** `/login`
- **Method:** `POST`
- **Yêu cầu xác thực:** Không
- **Payload (Request Body):**
  ```json
  {
    "email": "nva@gmail.com",
    "password": "password123"
  }
  ```
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Đăng nhập thành công",
      "user": {
        "_id": "6a86f...",
        "name": "Nguyễn Văn A",
        "email": "nva@gmail.com",
        "role": "user"
      },
      "token": "eyJhbGciOiJIUz...", // Token JWT dùng để xác thực các API khác
      "expiresIn": "1d"
    }
    ```
  - `400 Bad Request`: Báo lỗi thiếu email hoặc mật khẩu.
  - `401 Unauthorized`: Báo lỗi sai email hoặc mật khẩu.

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
  - `401 Unauthorized`: Token không hợp lệ hoặc chưa gửi token.
  - `404 Not Found`: Không tìm thấy user trong database (có thể đã bị xoá).

---

## 4. Đổi mật khẩu (Change Password)
- **Endpoint:** `/change-password`
- **Method:** `PUT`
- **Yêu cầu xác thực:** **Có**
- **Payload (Request Body):**
  ```json
  {
    "oldPassword": "password123",
    "newPassword": "newpassword123" // Yêu cầu >= 6 ký tự
  }
  ```
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Đổi mật khẩu thành công"
    }
    ```
  - `400 Bad Request`: Báo lỗi thiếu thông tin hoặc password mới < 6 ký tự.
  - `401 Unauthorized`: Báo lỗi sai mật khẩu hiện tại (oldPassword).

---

## 5. Đăng xuất (Logout)
- **Endpoint:** `/logout`
- **Method:** `POST`
- **Yêu cầu xác thực:** **Có**
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Đăng xuất thành công"
    }
    ```

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
        },
        // ... các user khác ...
      ]
    }
    ```
  - `403 Forbidden`: Tài khoản không có quyền truy cập (báo lỗi nếu role là "user" thông thường).

---

## 7. Thay đổi quyền truy cập (Đổi Role) - Chỉ Admin
- **Endpoint:** `/:id/role` (ví dụ: `/6a86f2089f702a12e89b2b09/role`)
- **Method:** `PATCH`
- **Yêu cầu xác thực:** **Có** (và bắt buộc user phải có `role` là `"admin"`)
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
  - `400 Bad Request`: Báo lỗi nếu gửi role không hợp lệ (ngoài `admin` và `user`).
  - `403 Forbidden`: Tài khoản đang thao tác không phải là admin.
  - `404 Not Found`: Không tìm thấy user có ID đó.

---

## 8. Xóa người dùng (Delete User)
- **Endpoint:** `/:id` (ví dụ: `/6a86f2089f702a12e89b2b09`)
- **Method:** `DELETE`
- **Yêu cầu xác thực:** **Có** (và bắt buộc user phải có `role` là `"admin"`)
- **Responses:**
  - `200 OK` (Thành công):
    ```json
    {
      "message": "Xóa người dùng thành công"
    }
    ```
  - `400 Bad Request`: Báo lỗi nếu admin cố gắng tự xóa chính tài khoản của mình ("Bạn không thể tự xóa tài khoản của chính mình").
  - `401 Unauthorized`: Token không hợp lệ hoặc chưa gửi token.
  - `403 Forbidden`: Tài khoản không có quyền truy cập (không phải admin).
  - `404 Not Found`: Không tìm thấy user có ID đó.

