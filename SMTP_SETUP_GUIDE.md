# SMTP Email Setup Guide

## Quick Start

### Option 1: Gmail (Recommended for Testing)

1. **Enable 2-Factor Authentication**
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it: "Shopify Sync App"
   - Copy the 16-character password

3. **Update .env file:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # App password from step 2
SMTP_FROM="Shopify Sync <noreply@yourapp.com>"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Restart your dev server**

### Option 2: SendGrid (Recommended for Production)

1. **Sign up:** https://sendgrid.com/
2. **Create API Key:** Settings → API Keys → Create API Key
3. **Update .env:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM="Shopify Sync <noreply@yourapp.com>"
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

### Option 3: Mailgun

1. **Sign up:** https://www.mailgun.com/
2. **Get SMTP credentials:** Sending → Domain Settings → SMTP
3. **Update .env:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
SMTP_FROM="Shopify Sync <noreply@yourapp.com>"
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

### Option 4: AWS SES

1. **Setup SES:** https://console.aws.amazon.com/ses/
2. **Create SMTP credentials:** Account Dashboard → SMTP Settings
3. **Update .env:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Your region
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM="Shopify Sync <noreply@yourapp.com>"
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

## Testing

### Test Email Sending:

```bash
# Create test file
cat > test-email.js << 'EOF'
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: process.env.SMTP_USER,
  subject: 'Test Email',
  html: '<h1>Test Email</h1><p>If you receive this, SMTP is working!</p>',
}).then(() => {
  console.log('✅ Email sent successfully!');
}).catch((err) => {
  console.error('❌ Error:', err);
});
EOF

# Run test
node test-email.js

# Clean up
rm test-email.js
```

### Test Forgot Password Flow:

1. Start your app: `npm run dev`
2. Go to: http://localhost:3000/signin
3. Click "Forgot password?"
4. Enter your email
5. Check your inbox (or console if SMTP not configured)

## Troubleshooting

### Gmail: "Less secure app access"
- **Solution:** Use App Password (not your regular password)
- Enable 2FA first, then generate App Password

### Port 587 blocked
- **Solution:** Try port 465 with `SMTP_SECURE=true`
- Or use port 2525 (some providers)

### "Authentication failed"
- Check username/password are correct
- For Gmail: Use App Password, not regular password
- For SendGrid: Username must be "apikey"

### "Connection timeout"
- Check firewall/antivirus blocking port
- Try different port (465, 2525)
- Check SMTP_HOST is correct

### Emails go to spam
- **Solution:** Configure SPF, DKIM, DMARC records
- Use verified domain
- Use professional email service (SendGrid, Mailgun)

## Development vs Production

### Development (Current Setup)
- SMTP optional
- Emails logged to console if not configured
- Good for testing without email setup

### Production (Recommended)
- Use professional email service (SendGrid, Mailgun, AWS SES)
- Configure SPF/DKIM/DMARC
- Monitor email delivery rates
- Set up bounce/complaint handling

## Environment Variables Reference

```env
# Required
SMTP_HOST=smtp.example.com          # SMTP server hostname
SMTP_PORT=587                        # SMTP port (587, 465, or 2525)
SMTP_USER=your-email@example.com    # SMTP username
SMTP_PASS=your-password              # SMTP password or API key

# Optional
SMTP_SECURE=false                    # true for port 465, false for others
SMTP_FROM="App Name <noreply@app.com>"  # From address (optional)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # App URL for email links
```

## Security Best Practices

1. **Never commit .env to git** - Already in .gitignore
2. **Use App Passwords** - Not your main email password
3. **Rotate credentials** - Change passwords periodically
4. **Monitor usage** - Check for unusual activity
5. **Use TLS** - Always use secure connection (port 587 or 465)

## Cost Comparison

| Provider | Free Tier | Paid Plans |
|----------|-----------|------------|
| Gmail | 500/day | N/A (personal use) |
| SendGrid | 100/day | $15/mo (40k emails) |
| Mailgun | 5,000/mo | $35/mo (50k emails) |
| AWS SES | 62,000/mo (from EC2) | $0.10/1000 emails |
| Postmark | 100/mo | $15/mo (10k emails) |

## Next Steps

1. Choose email provider
2. Get SMTP credentials
3. Update .env file
4. Restart dev server
5. Test forgot password flow
6. Monitor email delivery

For production deployment, consider using a dedicated email service with better deliverability and monitoring.
