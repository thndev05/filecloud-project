# FileCloud — File Management & Cloud Storage

FileCloud is a full-stack cloud file management application that lets users upload, organize, share, and restore files and folders.

## Features

- **User authentication** — Registration and login using JWT
- **File & folder management** — Upload, download, delete, and organize files
- **File sharing** — Share files via public links or direct user shares
- **Trash (soft delete)** — Restore deleted files from the trash
- **Realtime notifications** — Receive notifications when files are shared (WebSocket)
- **User profiles** — Update personal info and avatar
- **Modern UI** — Responsive interface built with Tailwind CSS and Framer Motion
- **Security** — Password hashing, JWT, and file access control

## Tech Stack

### Backend
- **NestJS** — Progressive Node.js framework
- **Prisma ORM** — Type-safe database toolkit for TypeScript
- **PostgreSQL** — Relational database
- **MinIO** — High-performance object storage
- **Socket.IO** — WebSocket layer for realtime notifications
- **JWT** — JSON Web Tokens for authentication
- **bcrypt** — Password hashing

### Frontend
- **React** — UI library
- **TypeScript** — Typed JavaScript
- **Vite** — Fast build tool
- **React Router** — Client routing
- **Tailwind CSS** — Utility-first CSS framework
- **Framer Motion** — Animations
- **Axios** — HTTP client
- **Socket.IO Client** — Realtime client
- **Lucide React** — Icon set

## Requirements

- Node.js 18+ and npm
- Docker and Docker Compose (recommended for PostgreSQL and MinIO)
- Git

## Installation & Running

### 1. Clone the repository

```bash
git clone <repository-url>
cd filecloud-project
```

### 2. Backend setup

```bash
cd backend
npm install
```

#### Backend environment

Create a `.env` file inside `backend` and set the following values:

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

#### Start Docker services

You can use the provided `docker-compose.yml` (create it in the project root or `backend`):

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

Start services:

```bash
docker-compose up -d
```

#### Run migrations and start backend

```bash
cd backend

# Run Prisma migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# Start backend in development
npm run start:dev
```

The backend will run at: `http://localhost:3000`.

Note: the MinIO bucket is created automatically on first backend startup.

### 3. Frontend setup

```bash
cd frontend
npm install
```

#### Frontend environment

Create a `.env` file inside `frontend`:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

#### Run frontend

```bash
npm run dev
```

The frontend will run at: `http://localhost:5173`.

## Project Structure

```
filecloud-project/
├── backend/                    # NestJS backend
│   ├── src/
│   │   ├── auth/              # Authentication module
│   │   ├── users/             # User management
│   │   ├── files/             # File module
│   │   ├── folders/           # Folder module
│   │   ├── shares/            # Sharing module
│   │   ├── notifications/     # Realtime notifications
│   │   ├── minio/             # MinIO storage integration
│   │   └── prisma/            # Prisma module
│   ├── prisma/
│   │   ├── schema.prisma      # Prisma schema
│   │   └── migrations/        # Database migrations
│   └── package.json
│
└── frontend/                   # React frontend
    ├── src/
    │   ├── components/        # React components
    │   ├── pages/             # App pages
    │   ├── services/          # API services
    │   ├── contexts/          # React contexts
    │   ├── layouts/           # Layout components
    │   └── utils/             # Utility functions
    └── package.json
```

## Useful Scripts

### Backend

```bash
# Development
npm run start:dev          # Start in watch mode
npm run start:debug        # Start with debugger

# Build
npm run build              # Build production
npm run start:prod         # Run production build

# Database
npm run prisma:migrate     # Run migrations
npm run prisma:generate    # Generate Prisma Client
npm run prisma:studio      # Open Prisma Studio
npm run prisma:migrate:reset  # Reset database (use with caution)

# Testing
npm run test               # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run tests with coverage
```

### Frontend

```bash
npm run dev                # Run development server
npm run build              # Build production
npm run preview            # Preview production build
npm run lint               # Run ESLint
npm run lint:fix           # Auto-fix ESLint issues
```

## Database Model (high level)

### User
- Stores user information (email, password, fullName, avatar)
- Tracks storage usage

### Folder
- Hierarchical folder structure
- Each folder belongs to a user
- Supports nested folders

### File
- File metadata (name, size, mimeType, storagePath)
- Soft delete (trash) support
- Files can live in a folder or at the root
- Optional password protection

### Share
- Share files via public link or direct shares
- Token-based access
- Status: pending, accepted, rejected
- Can be enabled/disabled

## Authentication Flow

1. User registers with email and password
2. Password is hashed with bcrypt
3. User logs in and receives a JWT token
4. Token is stored in a cookie
5. Requests include the token for authentication
6. Protected routes validate the token

## API Endpoints

### Auth
- `POST /auth/register` — Register
- `POST /auth/login` — Login
- `POST /auth/logout` — Logout
- `GET /auth/me` — Get current user

### Files
- `GET /files` — List files
- `POST /files/upload` — Upload file
- `GET /files/:id` — Get file metadata
- `GET /files/:id/download` — Download file
- `DELETE /files/:id` — Soft-delete file
- `PUT /files/:id/restore` — Restore file

### Folders
- `GET /folders` — List folders
- `POST /folders` — Create folder
- `GET /folders/:id` — Get folder
- `PUT /folders/:id` — Update folder
- `DELETE /folders/:id` — Delete folder

### Shares
- `POST /shares` — Create share
- `GET /shares` — List shares
- `GET /shares/token/:token` — Access shared file
- `PUT /shares/:id` — Update share
- `DELETE /shares/:id` — Delete share

### Users
- `GET /users/me` — Get profile
- `PUT /users/me` — Update profile
- `POST /users/avatar` — Upload avatar

## Frontend Routes

- `/login` — Login
- `/register` — Register
- `/dashboard` — Main dashboard
- `/my-files` — My files
- `/shared` — Files shared with me
- `/shared/:token` — Access shared file via token
- `/trash` — Trash
- `/settings` — Settings
- `/profile/edit` — Edit profile

## WebSocket Events

- `shareNotification` — Notify when a file is shared
- Connections authenticate using JWT

## UI Components

- **Header** — Navigation bar with user menu
- **Sidebar** — Navigation sidebar
- **FileTable** — Table-style file listing
- **ShareModal** — File sharing modal
- **ShareNotificationModal** — Share notification modal
- **UploadButton** — File upload button
- **FilterBar** — Filter and search controls
- **Modal** — Reusable modal component
- **ProtectedRoute** — Route guard requiring authentication

## Development

### Add a new migration

```bash
cd backend
npm run prisma:migrate
```

### Open Prisma Studio

```bash
cd backend
npm run prisma:studio
```

Open Prisma Studio at: `http://localhost:5555`

### MinIO Console

Open MinIO Console at: `http://localhost:9001`

- Username: `minioadmin`
- Password: `minioadmin`

## TODO / Improvements

- [ ] Support multi-file uploads
- [ ] File previews (images, PDFs)
- [ ] Advanced search & filters
- [ ] Folder sharing
- [ ] Fine-grained permissions (view, edit, download)
- [ ] Activity logs
- [ ] Storage quota management
- [ ] File versioning
- [ ] Collaborative editing
- [ ] Mobile app

## Contributing

Contributions are welcome — please open an issue or submit a pull request.

## License

MIT License

## Author

[Your Name]

## Contact

- Email: your.email@example.com
- GitHub: [@yourusername](https://github.com/yourusername)

---

**Note:** This is a demo/learning project. Do not use it in production without additional security and performance hardening.
