# Hướng dẫn triển khai FileCloud lên VPS và kết nối PostgreSQL

Tài liệu này hướng dẫn từng bước đưa FileCloud (NestJS + PostgreSQL + MinIO + React) lên một VPS Ubuntu bằng **Docker Compose**, chạy trên domain riêng có HTTPS.

## 1. Kiến trúc trên VPS

```
Trình duyệt ──HTTPS──► Nginx trên host (:443, chứng chỉ Let's Encrypt)
                        ├── https://<domain>/            → container frontend (127.0.0.1:8080)
                        ├── https://<domain>/api/*       → container backend  (127.0.0.1:3000)
                        ├── https://<domain>/socket.io/  → container backend  (WebSocket)
                        └── https://s3.<domain>/         → container minio    (127.0.0.1:9000)

docker-compose.yml
  postgres  (postgres:16-alpine, volume postgres_data)
  minio     (minio/minio, volume minio_data)
  backend   (NestJS, kết nối DB qua host nội bộ "postgres:5432")
  frontend  (nginx:alpine phục vụ bản build React)
```

- Mọi cổng của container chỉ bind vào `127.0.0.1`. Ra Internet chỉ có 22 (SSH), 80 và 443.
- PostgreSQL **không** publish cổng ra ngoài. Backend kết nối qua mạng nội bộ do Docker Compose tạo, dùng tên service `postgres` làm hostname.
- MinIO cần subdomain riêng (`s3.<domain>`) vì link tải file chia sẻ (presigned URL) được ký theo host. Host đó phải là địa chỉ mà trình duyệt truy cập được.

## 2. Chuẩn bị

| Thành phần | Yêu cầu |
|---|---|
| VPS | Ubuntu 22.04 hoặc 24.04, khuyến nghị 2 GB RAM trở lên (build image trên VPS 1 GB có thể thiếu RAM, cần thêm swap) |
| Domain | Hai bản ghi DNS loại **A** trỏ về IP của VPS: `<domain>` và `s3.<domain>` |
| Source code | Đã push lên GitHub (hoặc Git server khác) |

Kiểm tra DNS đã trỏ đúng trước khi làm tiếp. Nếu DNS chưa trỏ, certbot sẽ không cấp được chứng chỉ:

```bash
dig +short <domain>
dig +short s3.<domain>
```

## 3. Cách nhanh: một lệnh

```bash
ssh root@<ip-vps>
git clone <repository-url> /opt/filecloud
cd /opt/filecloud
sudo bash deploy/setup.sh <domain> <email-nhận-thông-báo-ssl>
```

> Nếu repo là **private**, clone bằng HTTPS và dùng [Personal Access Token](https://github.com/settings/tokens) của GitHub thay cho mật khẩu khi được hỏi. Một cách khác là tạo SSH key trên VPS (`ssh-keygen -t ed25519`), thêm public key vào mục **Deploy keys** của repo, rồi clone bằng `git@github.com:...`.

Script [deploy/setup.sh](deploy/setup.sh) sẽ thực hiện lần lượt các bước ở mục 4. Khi chạy xong, truy cập `https://<domain>`. Mật khẩu và secret được sinh ngẫu nhiên, lưu trong file `.env` ở thư mục gốc (quyền `600`).

## 4. Từng bước thủ công (giải thích những gì script làm)

### Bước 1: Cài Docker, Nginx, certbot

```bash
sudo apt-get update
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx ufw
curl -fsSL https://get.docker.com | sudo sh     # Docker Engine + plugin docker compose
docker compose version
```

### Bước 2: Tường lửa

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'     # 80 + 443
sudo ufw --force enable
```

> Docker có thể mở cổng mà không đi qua ufw. Vì vậy trong `docker-compose.yml` mọi cổng đều ghi rõ `127.0.0.1:...`.

### Bước 3: Tạo file `.env` (cấu hình và mật khẩu)

```bash
cd /opt/filecloud
cp .env.example .env
nano .env
```

```env
DOMAIN=<domain>
POSTGRES_PASSWORD=<openssl rand -hex 16>
MINIO_ROOT_USER=filecloud
MINIO_ROOT_PASSWORD=<openssl rand -hex 16>
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
```

Docker Compose tự đọc file này và truyền giá trị vào các container. Không cần tạo `backend/.env` hay `frontend/.env`, vì frontend đã có sẵn [frontend/.env.production](frontend/.env.production) để gọi API qua `/api`.

### Bước 4: Kết nối PostgreSQL (cách cấu hình trong Compose)

Trong [docker-compose.yml](docker-compose.yml):

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: filecloud
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_DB: filecloud           # lần chạy đầu, image tự tạo user + database này
  volumes:
    - postgres_data:/var/lib/postgresql/data   # dữ liệu không mất khi container bị xoá
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U filecloud -d filecloud"]

backend:
  depends_on:
    postgres:
      condition: service_healthy    # chỉ khởi động backend khi PostgreSQL đã sẵn sàng
  environment:
    DATABASE_URL: postgresql://filecloud:${POSTGRES_PASSWORD}@postgres:5432/filecloud?schema=public
```

Chuỗi kết nối có dạng `postgresql://<user>:<password>@<host>:<port>/<database>?schema=public`. Ở đây `<host>` là `postgres`, tức tên service trong Compose. Docker có DNS nội bộ nên các container gọi nhau bằng tên service.

Mỗi lần khởi động, container backend chạy `npx prisma migrate deploy` trước ([backend/Dockerfile](backend/Dockerfile)) để tạo hoặc cập nhật bảng theo thư mục `backend/prisma/migrations/`. Sau đó mới chạy API.

### Bước 5: Nginx và HTTPS

```bash
sed "s/__DOMAIN__/<domain>/g" deploy/nginx.conf | sudo tee /etc/nginx/sites-available/filecloud
sudo ln -sf /etc/nginx/sites-available/filecloud /etc/nginx/sites-enabled/filecloud
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx --redirect -m <email> -d <domain> -d s3.<domain>
```

Những điểm chính trong [deploy/nginx.conf](deploy/nginx.conf):
- `location /api/`: chuyển request tới backend và bỏ tiền tố `/api`. Tiền tố này cần thiết vì frontend và backend có route trùng tên (`/files`, `/shares`).
- `proxy_cookie_path`: sửa đường dẫn cookie refresh token thành `/api/auth/refresh`. Nếu thiếu dòng này, người dùng sẽ bị đăng xuất sau 15 phút.
- `location /socket.io/`: cho phép kết nối WebSocket (header `Upgrade`).
- `client_max_body_size 100M`: giới hạn kích thước file upload.

certbot tự gia hạn chứng chỉ thông qua systemd timer.

### Bước 6: Build và chạy

```bash
sudo bash deploy/deploy.sh      # = docker compose up -d --build
```

Lần đầu mất vài phút để build image. Các container được đặt `restart: unless-stopped` nên sẽ tự chạy lại khi VPS reboot.

## 5. Kiểm tra sau khi deploy

```bash
docker compose ps                                  # 4 service đều Up, postgres (healthy)
docker compose logs backend | tail -20             # "All migrations have been successfully applied", "Bucket filecloud ..."
curl -I https://<domain>                           # 200
curl https://<domain>/api/auth/me                  # 401 nghĩa là backend đã chạy
docker compose exec postgres psql -U filecloud -d filecloud -c '\dt'   # users, files, folders, shares, _prisma_migrations
```

Kiểm tra trên trình duyệt: đăng ký tài khoản, upload file, tạo link chia sẻ và mở link đó trong cửa sổ ẩn danh. Tài liệu API: `https://<domain>/api/api/docs`.

## 6. Cập nhật phiên bản mới

```bash
cd /opt/filecloud
git pull
sudo bash deploy/deploy.sh
```

Khi sửa `prisma/schema.prisma` ở máy local, cần chạy `npx prisma migrate dev --name <ten-thay-doi>` rồi commit thư mục migration mới. Trên VPS, container backend sẽ tự áp dụng migration đó khi khởi động lại.

## 7. Sao lưu và khôi phục database

```bash
docker compose exec -T postgres pg_dump -U filecloud filecloud > filecloud-$(date +%F).sql   # sao lưu
docker compose exec -T postgres psql -U filecloud filecloud < filecloud-2026-10-19.sql       # khôi phục
```

> `docker compose down -v` sẽ **xoá luôn volume dữ liệu** (database và file). Chỉ dùng `docker compose down` (không có `-v`) để dừng hệ thống.

## 8. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `required variable ... is missing` khi chạy compose | Chưa có file `.env` ở thư mục gốc, hoặc thiếu biến. So sánh với `.env.example` |
| Backend liên tục restart, log báo `P1000: Authentication failed` | Đã đổi `POSTGRES_PASSWORD` sau lần chạy đầu. Image Postgres chỉ tạo user một lần nên phải đổi lại mật khẩu cũ, hoặc `ALTER USER` trong `psql` |
| Backend restart, log báo lỗi MinIO | DNS hoặc chứng chỉ của `s3.<domain>` chưa sẵn sàng, hoặc container minio chưa chạy (`docker compose ps`) |
| Link chia sẻ không tải được file | `MINIO_ENDPOINT` không phải host công khai. Mặc định là `s3.${DOMAIN}`, kiểm tra lại `DOMAIN` trong `.env` |
| Bị đăng xuất sau 15 phút | Thiếu `proxy_cookie_path` trong cấu hình Nginx, hoặc site chưa chạy HTTPS (cookie đặt `secure` khi `NODE_ENV=production`) |
| Upload file lớn báo lỗi 413 | Tăng `client_max_body_size` trong cấu hình Nginx |
| Build image bị `Killed` | VPS thiếu RAM. Tạo swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` |

## 9. Chạy thử toàn bộ stack trên máy local

Tạo file `.env` từ `.env.example`, thêm các dòng sau để backend dùng MinIO nội bộ thay vì `s3.<domain>`:

```env
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
FRONTEND_URL=http://localhost:8080
```

```bash
docker compose up -d --build
curl http://localhost:3000/auth/me     # 401
```

Ở chế độ này frontend (`localhost:8080`) gọi `/api` nhưng không có Nginx đứng trước, nên chỉ dùng để kiểm tra backend và database. Khi phát triển giao diện, dùng `npm run dev` như trong README.
