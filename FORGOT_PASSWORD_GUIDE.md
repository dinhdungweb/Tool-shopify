# Forgot Password Feature - Complete ✅

## Tổng Quan
Chức năng quên mật khẩu đã được triển khai đầy đủ với email reset link.

## Flow Hoạt Động

### 1. User Quên Mật Khẩu
1. Click "Forgot password?" trên trang sign in
2. Nhập email → Submit
3. Nhận email với reset link (trong dev mode: xem console log)
4. Click link trong email

### 2. Reset Password
1. Link mở trang reset password với token
2. Verify token (valid, chưa dùng, chưa hết hạn)
3. Nhập password mới + confirm
4. Submit → Password được reset
5. Tất cả sessions cũ bị xóa (force re-login)
6. Redirect về sign in

## Các Thành Phần

### Database
```prisma
model PasswordReset {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(...)
}
```

### API Routes
- `POST /api/auth/forgot-password` - Tạo reset token & gửi email
- `GET /api/auth/reset-password?token=xxx` - Verify token
- `POST /api/auth/reset-password` - Reset password

### Frontend Pages
- `/forgot-password` - Form nhập email
- `/reset-password?token=xxx` - Form nhập password mới

### Email Service
- `src/lib/email.ts` - Send email function
- Development mode: Log to console
- Production mode: Cần config SMTP

## Security Features

✅ **Token Security**
- Random 32-byte hex token
- Expires sau 1 giờ
- One-time use (marked as used after reset)
- Cascade delete khi xóa user

✅ **Privacy**
- Không tiết lộ email có tồn tại hay không
- Luôn trả về success message

✅ **Session Management**
- Xóa tất cả sessions sau reset
- Force user re-login trên tất cả devices

## Configuration

### Development Mode (Hiện Tại)
Email được log ra console thay vì gửi thật:
```
📧 Email would be sent:
To: user@example.com
Subject: Reset Your Password
Content: [HTML email]
```

### Production Mode (Cần Setup)

1. **Install nodemailer:**
```bash
npm install nodemailer
```

2. **Add env variables:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Your App <noreply@yourapp.com>"
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

3. **Uncomment code trong `src/lib/email.ts`**

### Gmail Setup (Recommended)
1. Enable 2-factor authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use App Password as SMTP_PASS

## Testing

### Test Flow:
1. Vào http://localhost:3000/signin
2. Click "Forgot password?"
3. Nhập email: `admin@test.com`
4. Check console log để lấy reset link
5. Copy link và paste vào browser
6. Nhập password mới
7. Sign in với password mới

### Test với curl:
```bash
# Request reset
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com"}'

# Verify token
curl http://localhost:3000/api/auth/reset-password?token=YOUR_TOKEN

# Reset password
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN","password":"newpass123"}'
```

## Customization

### Email Template
Edit `generatePasswordResetEmail()` trong `src/lib/email.ts` để thay đổi:
- Styling
- Content
- Branding

### Token Expiry
Edit `RESET_TOKEN_DURATION` trong `src/lib/auth.ts`:
```typescript
const RESET_TOKEN_DURATION = 60 * 60 * 1000; // 1 hour
```

### Email Provider
Thay nodemailer bằng:
- SendGrid
- AWS SES
- Mailgun
- Postmark

## Troubleshooting

**Email không gửi được:**
- Check SMTP credentials
- Check firewall/port blocking
- Try different SMTP provider

**Token invalid:**
- Check token chưa expire
- Check token chưa được dùng
- Check database có record

**Link không hoạt động:**
- Check NEXT_PUBLIC_APP_URL đúng
- Check middleware cho phép /reset-password

## Next Steps (Optional)

- [ ] Rate limiting cho forgot password (prevent spam)
- [ ] Email verification sau đăng ký
- [ ] Password strength indicator
- [ ] Password history (không cho dùng lại password cũ)
