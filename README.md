# Self-Storage Management System - Frontend

Frontend của hệ thống quản lý kho lưu trữ, được xây dựng bằng React, TypeScript và Vite.

## Yêu cầu

- Node.js 18+
- npm

## Cài đặt và chạy

```bash
npm install
npm run dev
```

Sau đó mở URL Vite hiển thị trong terminal, thường là `http://localhost:5173`.

## Các lệnh thường dùng

```bash
npm run build       # Build production
npm run preview     # Xem bản build production
npm run typecheck   # Kiểm tra TypeScript
npm test            # Chạy test bằng Vitest
npm run format      # Format source code
```

## Các nhóm người dùng

Ứng dụng hỗ trợ các không gian làm việc theo vai trò:

- Customer
- Staff
- Manager
- Business
- Admin

## Cấu trúc chính

```text
src/
├── auth/          # Phân quyền và permission
├── components/    # Component dùng chung
├── data/          # Dữ liệu dùng chung cho frontend
├── domain/        # Luật nghiệp vụ phía frontend
├── services/      # API client và các service tích hợp backend
├── store/         # State dùng chung của ứng dụng
├── types/         # TypeScript types
└── views/         # Màn hình theo từng vai trò
```

## Lưu ý

- Không commit các file chứa thông tin bí mật như `.env.local`.
- Frontend và backend nằm ở hai repository riêng biệt trong thư mục `Self-Storage Management System`.

