# FileCloud - Hệ thống Quản lý và Lưu trữ File

FileCloud là một ứng dụng quản lý và lưu trữ file đám mây full-stack, cho phép người dùng tải lên, quản lý, chia sẻ file và thư mục một cách dễ dàng.

## Tính năng

- **Xác thực người dùng** - Đăng ký, đăng nhập với JWT
- **Quản lý file & thư mục** - Tải lên, tải xuống, xóa, tổ chức file
- **Chia sẻ file** - Chia sẻ file thông qua link công khai hoặc trực tiếp với người dùng
- **Thùng rác** - Khôi phục file đã xóa
- **Thông báo realtime** - Nhận thông báo khi có file được chia sẻ (WebSocket)
- **Quản lý hồ sơ** - Cập nhật thông tin cá nhân và avatar
- **Giao diện hiện đại** - UI responsive với Tailwind CSS và Framer Motion
- **Bảo mật** - Mã hóa mật khẩu, JWT authentication, file access control

## Công nghệ sử dụng

### Backend
- **NestJS** - Framework Node.js progressive
- **Prisma ORM** - ORM thế hệ mới cho TypeScript
- **PostgreSQL** - Cơ sở dữ liệu quan hệ
- **MinIO** - Object storage hiệu năng cao
- **Socket.IO** - WebSocket cho realtime notifications
- **JWT** - JSON Web Tokens cho authentication
- **Bcrypt** - Mã hóa mật khẩu

### Frontend
- **React 19** - Thư viện UI
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool nhanh
- **React Router** - Routing
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Axios** - HTTP client
- **Socket.IO Client** - WebSocket client
- **Lucide React** - Icon library

## Yêu cầu

- **Node.js** 18+ và npm
- **Docker** và **Docker Compose** (để chạy PostgreSQL và MinIO)
- **Git**

## Cài đặt và Chạy

### 1. Clone repository

```bash
git clone <repository-url>
cd filecloud-project
```

### 2. Cài đặt Backend

```bash
cd backend
npm install
```

#### Cấu hình môi trường Backend

Tạo file `.env` trong thư mục `backend`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/filecloud?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=filecloud
```

#### Khởi động Docker Services

Tạo file `docker-compose.yml` trong thư mục gốc hoặc backend:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: filecloud-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: filecloud
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    container_name: filecloud-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

Khởi động services:

```bash
docker-compose up -d
```

#### Chạy migration và tạo bucket MinIO

```bash
cd backend

# Chạy Prisma migration
npm run prisma:migrate

# Chạy Prisma generate
npm run prisma:generate

# Khởi động backend
npm run start:dev
```

Backend sẽ chạy tại: `http://localhost:3000`

**Lưu ý:** Bucket MinIO sẽ được tự động tạo khi backend khởi động lần đầu.

### 3. Cài đặt Frontend

```bash
cd frontend
npm install
```

#### Cấu hình môi trường Frontend

Tạo file `.env` trong thư mục `frontend`:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

#### Khởi động Frontend

```bash
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

## Cấu trúc Project

```
filecloud-project/
├── backend/                    # Backend NestJS
│   ├── src/
│   │   ├── auth/              # Module xác thực
│   │   ├── users/             # Module quản lý người dùng
│   │   ├── files/             # Module quản lý file
│   │   ├── folders/           # Module quản lý thư mục
│   │   ├── shares/            # Module chia sẻ
│   │   ├── notifications/     # Module thông báo realtime
│   │   ├── minio/             # Module MinIO storage
│   │   └── prisma/            # Module Prisma
│   ├── prisma/
│   │   ├── schema.prisma      # Prisma schema
│   │   └── migrations/        # Database migrations
│   └── package.json
│
└── frontend/                   # Frontend React
    ├── src/
    │   ├── components/        # React components
    │   ├── pages/             # Các trang
    │   ├── services/          # API services
    │   ├── contexts/          # React contexts
    │   ├── layouts/           # Layout components
    │   └── utils/             # Utility functions
    └── package.json
```

## Scripts hữu ích

### Backend

```bash
# Development
npm run start:dev          # Chạy ở chế độ watch
npm run start:debug        # Chạy với debug mode

# Build
npm run build              # Build production
npm run start:prod         # Chạy production

# Database
npm run prisma:migrate     # Chạy migration
npm run prisma:generate    # Generate Prisma Client
npm run prisma:studio      # Mở Prisma Studio
npm run prisma:migrate:reset  # Reset database

# Testing
npm run test               # Chạy tests
npm run test:watch         # Chạy tests ở chế độ watch
npm run test:cov           # Test với coverage
```

### Frontend

```bash
npm run dev                # Chạy development server
npm run build              # Build production
npm run preview            # Preview production build
npm run lint               # Chạy ESLint
npm run lint:fix           # Fix ESLint errors
```

## Database Schema

### User
- Thông tin người dùng (email, password, fullName, avatar)
- Theo dõi storage đã sử dụng

### Folder
- Cấu trúc thư mục phân cấp
- Mỗi folder thuộc về một user
- Hỗ trợ nested folders

### File
- Metadata file (name, size, mimeType, storagePath)
- Hỗ trợ soft delete (thùng rác)
- File có thể nằm trong folder hoặc ở root
- Hỗ trợ bảo vệ bằng mật khẩu

### Share
- Chia sẻ file qua link công khai hoặc trực tiếp
- Token-based access
- Trạng thái: pending, accepted, rejected
- Có thể kích hoạt/vô hiệu hóa

## Authentication Flow

1. User đăng ký với email và password
2. Password được hash bằng bcrypt
3. User đăng nhập và nhận JWT token
4. Token được lưu trong cookie
5. Mọi request đều gửi kèm token để xác thực
6. Protected routes kiểm tra token validity

## API Endpoints

### Auth
- `POST /auth/register` - Đăng ký
- `POST /auth/login` - Đăng nhập
- `POST /auth/logout` - Đăng xuất
- `GET /auth/me` - Lấy thông tin user hiện tại

### Files
- `GET /files` - Lấy danh sách file
- `POST /files/upload` - Tải lên file
- `GET /files/:id` - Lấy thông tin file
- `GET /files/:id/download` - Tải xuống file
- `DELETE /files/:id` - Xóa file (soft delete)
- `PUT /files/:id/restore` - Khôi phục file

### Folders
- `GET /folders` - Lấy danh sách folder
- `POST /folders` - Tạo folder mới
- `GET /folders/:id` - Lấy thông tin folder
- `PUT /folders/:id` - Cập nhật folder
- `DELETE /folders/:id` - Xóa folder

### Shares
- `POST /shares` - Tạo share
- `GET /shares` - Lấy danh sách shares
- `GET /shares/token/:token` - Truy cập shared file
- `PUT /shares/:id` - Cập nhật share
- `DELETE /shares/:id` - Xóa share

### Users
- `GET /users/me` - Lấy profile
- `PUT /users/me` - Cập nhật profile
- `POST /users/avatar` - Upload avatar

## Trang Frontend

- `/login` - Đăng nhập
- `/register` - Đăng ký
- `/dashboard` - Trang chủ sau khi đăng nhập
- `/my-files` - Quản lý file của tôi
- `/shared` - File được chia sẻ với tôi
- `/shared/:token` - Truy cập file qua link chia sẻ
- `/trash` - Thùng rác
- `/settings` - Cài đặt
- `/profile/edit` - Chỉnh sửa hồ sơ

## WebSocket Events

- `shareNotification` - Nhận thông báo khi có file được chia sẻ
- Connection tự động với JWT authentication

## UI Components

- **Header** - Navigation bar với user menu
- **Sidebar** - Navigation sidebar
- **FileTable** - Hiển thị danh sách file dạng table
- **ShareModal** - Modal chia sẻ file
- **ShareNotificationModal** - Modal thông báo chia sẻ
- **UploadButton** - Button tải lên file
- **FilterBar** - Bộ lọc và tìm kiếm
- **Modal** - Component modal tái sử dụng
- **ProtectedRoute** - Route bảo vệ cần authentication

## Development

### Thêm migration mới

```bash
cd backend
npm run prisma:migrate
```

### Xem database với Prisma Studio

```bash
cd backend
npm run prisma:studio
```

Truy cập: `http://localhost:5555`

### Truy cập MinIO Console

Truy cập: `http://localhost:9001`
- Username: `minioadmin`
- Password: `minioadmin`

## Todo / Cải tiến

- [ ] Hỗ trợ upload nhiều file cùng lúc
- [ ] Preview file (images, PDFs)
- [ ] Search và filter nâng cao
- [ ] Chia sẻ folder
- [ ] Permissions chi tiết hơn (view, edit, download)
- [ ] Activity logs
- [ ] Storage quota management
- [ ] File versioning
- [ ] Collaborative editing
- [ ] Mobile app

## Đóng góp

Mọi đóng góp đều được chào đón! Hãy tạo issue hoặc pull request.

## License

MIT License

## Tác giả

[Your Name]

## Liên hệ

- Email: your.email@example.com
- GitHub: [@yourusername](https://github.com/yourusername)

---

**Lưu ý:** Đây là project demo/học tập. Không nên sử dụng trực tiếp trong production mà không có các biện pháp bảo mật và tối ưu hóa bổ sung.
