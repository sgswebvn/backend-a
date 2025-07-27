git pull origin
npm run build 
pm2 restart backend-a


git add .
git commit -m "upload"
git push origin


# Facebook Fanpage Management System

## Tính năng chính:

1. Quản lý người dùng
   - Đăng ký/Đăng nhập tài khoản
   - Liên kết với Facebook
   - Quản lý thông tin cá nhân

2. Quản lý Fanpage
   - Kết nối/Ngắt kết nối Fanpage
   - Xem danh sách Fanpage đã kết nối
   - Đồng bộ dữ liệu Fanpage (posts, comments, messages)

3. Tương tác Fanpage
   - Xem và phản hồi comments
   - Xem và phản hồi messages
   - Quản lý bài đăng

4. Quản lý gói dịch vụ
   - Gói miễn phí (1 Fanpage)
   - Các gói nâng cao (nhiều Fanpage)
   - Thanh toán qua PayOS

## Cài đặt

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build
npm run build

# Run in production
npm start
```

## Cấu hình môi trường

Tạo file `.env`:

```
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=your_mongodb_uri

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d

# Facebook
FB_APP_ID=your_fb_app_id
FB_APP_SECRET=your_fb_app_secret
FB_CALLBACK_URL=http://localhost:5000/api/auth/facebook/callback

# Redis
REDIS_URL=your_redis_url

# PayOS
PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key
```

## API Documentation

See [API.md](docs/API.md) for detailed API documentation.
