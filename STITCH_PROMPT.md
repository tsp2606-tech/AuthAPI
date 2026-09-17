# Yêu cầu (Prompt) cho Stitch AI:

Tạo một trang **Admin Dashboard** bằng React và Tailwind CSS, đóng vai trò là Management Console cho hệ thống AuthAPI của tôi.

Giao diện cần bám sát thiết kế trong ảnh tham khảo: Layout gồm một Sidebar cố định bên trái (chứa menu Navigation như Overview, Credentials, Usage, Security) và một Topbar phía trên cùng.

## 1. Yêu cầu hiển thị Thống kê (Overview)
- Ngay khi load trang, hãy gọi API `GET http://localhost:3001/api/auth/admin/dashboard`.
- **Yêu cầu Headers:** Bắt buộc gửi kèm `Authorization: Bearer <token>` (lấy token từ `localStorage.getItem('token')`).
- Dữ liệu API trả về có dạng:
  ```json
  {
    "stats": { "totalUsers": 10, "adminCount": 2, "userCount": 8 },
    "users": [ ...danh sách user... ]
  }
  ```
- **Vẽ UI:** Hiển thị 3 thẻ (Cards) nổi bật phần thống kê (Total Users, Admin Count, User Count) giống như các thẻ "Active Sessions" hay "API Health" trong ảnh mẫu.

## 2. Bảng quản lý người dùng (User Management Table)
- Thay thế phần "Recent Admin Actions" trong ảnh bằng một bảng **User Management**.
- Đổ dữ liệu từ mảng `response.users` vào bảng này.
- Các cột cần có: Name, Email, Role, Created At, Actions.
- Sử dụng **Badge** để phân biệt Role: ví dụ chữ `Admin` nền xanh nhạt, chữ `User` nền xám nhạt.
- **Tính năng Đổi Quyền (Change Role):** 
  - Tại cột Actions của mỗi dòng, thêm một Dropdown hoặc Nút bấm (Ví dụ: "Make Admin" / "Demote to User").
  - Khi bấm, gọi API `PATCH http://localhost:3001/api/auth/{id}/role` với body là `{ "role": "admin" }` (hoặc "user").
  - Đừng quên gắn Header `Authorization: Bearer <token>`.
  - Nếu API báo thành công (`200 OK`), hiển thị Toast notification và tự động cập nhật lại bảng danh sách mà không cần reload trang.

## 3. Xử lý lỗi (Error Handling)
- Nếu API trả về mã lỗi `401 Unauthorized` hoặc `403 Forbidden`, hãy tự động xoá token trong localStorage và dùng React Router (hoặc window.location) để đẩy người dùng về trang `/login`.

## 4. Design System (Tailwind)
- Sử dụng tông màu xanh dương chủ đạo (`#0F62FE` hoặc tương đương của Tailwind).
- Nền trang (Background) màu xám rất nhạt (`bg-slate-50`).
- Các Card phải có viền mỏng (`border-gray-200`), bo góc (`rounded-lg`) và hiệu ứng đổ bóng nhẹ (`shadow-sm`).
- Font chữ gọn gàng, hiện đại (như Inter hoặc Roboto).
