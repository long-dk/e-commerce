# Email Verification Setup Guide

This guide explains how to set up email verification for user registration in the e-commerce platform.

## Overview

The Auth Service includes email verification to ensure users provide valid email addresses. When users register with email/password, they receive a verification email containing a secure link to activate their account.

## Features

- **Automatic Email Sending:** Verification emails sent immediately after registration
- **Secure Tokens:** 64-character random hex tokens with 24-hour expiration
- **Resend Functionality:** Users can request new verification emails
- **Token Validation:** One-time use tokens that are cleared after verification
- **Email Templates:** Professional HTML and plain text email templates
- **Error Handling:** Comprehensive error messages for invalid/expired tokens

## Email Service Architecture

```
User Registration
    ↓
Auth Service creates user (isEmailVerified: false)
    ↓
EmailService.sendVerificationEmail()
    ↓
SMTP Server sends email
    ↓
User clicks verification link
    ↓
Auth Service.verifyEmail(token)
    ↓
User account activated (isEmailVerified: true)
```

## SMTP Configuration

### Using Gmail

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password:**
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password (not your regular password)

3. **Environment Variables:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
EMAIL_FROM_NAME=E-Commerce
EMAIL_FROM_ADDRESS=noreply@ecommerce.com
```

### Using Other SMTP Providers

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Mailgun:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

## Email Templates

### Verification Email

**Subject:** "Verify Your Email Address"

**HTML Template:**
- Professional design with E-Commerce branding
- Clear call-to-action button
- Verification link with token
- Expiration notice (24 hours)
- Plain text fallback

**Content:**
```
Welcome to E-Commerce!

Please verify your email address to complete your registration.

[Verify Email Address] (button)

If the button doesn't work, copy and paste this link:
http://localhost:3000/verify-email?token=abc123...

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.
```

### Password Reset Email (Future Feature)

**Subject:** "Reset Your Password"

**Content:**
```
You requested a password reset for your E-Commerce account.

[Reset Password] (button)

Link: http://localhost:3000/reset-password?token=xyz789...

This link will expire in 1 hour.
```

## GraphQL API Integration

### Send Verification Email

```graphql
mutation SendVerificationEmail($email: String!) {
  sendVerificationEmail(email: $email)
}
```

**Usage:**
```javascript
// Resend verification email
const SEND_VERIFICATION = gql`
  mutation SendVerificationEmail($email: String!) {
    sendVerificationEmail(email: $email)
  }
`;

const [sendVerification, { loading }] = useMutation(SEND_VERIFICATION);

// In component
await sendVerification({ variables: { email: userEmail } });
```

### Verify Email

```graphql
mutation VerifyEmail($token: String!) {
  verifyEmail(token: $token) {
    id
    email
    firstName
    lastName
    role
    createdAt
    updatedAt
  }
}
```

**Usage:**
```javascript
// Handle email verification from URL
const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) {
      id
      email
      isEmailVerified
    }
  }
`;

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

if (token) {
  try {
    const result = await verifyEmail({ variables: { token } });
    // Show success message, redirect to login
  } catch (error) {
    // Show error message
  }
}
```

## Frontend Implementation

### Registration Flow

```jsx
function RegisterForm() {
  const [register, { loading }] = useMutation(REGISTER_MUTATION);

  const handleSubmit = async (formData) => {
    try {
      const result = await register({
        variables: {
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
        }
      });

      // Show success message
      alert('Registration successful! Please check your email to verify your account.');

      // Redirect to login or show verification pending state
      navigate('/login');

    } catch (error) {
      // Handle registration error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating Account...' : 'Register'}
      </button>
    </form>
  );
}
```

### Email Verification Page

```jsx
function VerifyEmail() {
  const [verifyEmail, { loading, error }] = useMutation(VERIFY_EMAIL);
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (token) {
        try {
          await verifyEmail({ variables: { token } });
          // Success - redirect to login with success message
          navigate('/login?verified=true');
        } catch (err) {
          // Error - show error message
          setError('Verification failed. The link may be expired.');
        }
      }
    };

    verify();
  }, []);

  if (loading) return <div>Verifying your email...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Email verified successfully! Redirecting...</div>;
}
```

### Resend Verification Email

```jsx
function ResendVerification({ email }) {
  const [sendVerification, { loading }] = useMutation(SEND_VERIFICATION_EMAIL);

  const handleResend = async () => {
    try {
      await sendVerification({ variables: { email } });
      alert('Verification email sent!');
    } catch (error) {
      alert('Failed to send verification email');
    }
  };

  return (
    <button onClick={handleResend} disabled={loading}>
      {loading ? 'Sending...' : 'Resend Verification Email'}
    </button>
  );
}
```

## Database Schema

### User Entity Updates

```typescript
@Entity('users')
export class User extends BaseEntity {
  // ... existing fields

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires?: Date;

  // ... existing fields
}
```

### Migration (if needed)

```sql
ALTER TABLE users
ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verification_token VARCHAR(255),
ADD COLUMN email_verification_expires TIMESTAMP;
```

## Security Considerations

### Token Security

1. **Random Generation:** Uses `crypto.randomBytes(32).toString('hex')`
2. **Expiration:** 24 hours maximum validity
3. **One-Time Use:** Tokens cleared after successful verification
4. **No Sensitive Data:** Tokens contain no user information

### Rate Limiting

Consider implementing rate limiting for:
- Registration attempts per IP
- Verification email resends per email
- Verification attempts per token

### Email Content Security

- **No Passwords:** Never include passwords in emails
- **Secure Links:** Use HTTPS in production
- **Token Obfuscation:** Tokens are not guessable
- **Expiration Warnings:** Clear expiration notices

## Error Handling

### Common Errors

**Invalid Token:**
```json
{
  "errors": [
    {
      "message": "Invalid verification token",
      "extensions": { "code": "BAD_USER_INPUT" }
    }
  ]
}
```

**Expired Token:**
```json
{
  "errors": [
    {
      "message": "Verification token has expired",
      "extensions": { "code": "BAD_USER_INPUT" }
    }
  ]
}
```

**Already Verified:**
```json
{
  "errors": [
    {
      "message": "Email is already verified",
      "extensions": { "code": "BAD_USER_INPUT" }
    }
  ]
}
```

### Frontend Error Handling

```javascript
try {
  const result = await verifyEmail({ variables: { token } });

  if (result.data.verifyEmail) {
    // Success - user is now verified
    showSuccessMessage('Email verified successfully!');
    navigate('/login');
  }
} catch (error) {
  const message = error.graphQLErrors?.[0]?.message || 'Verification failed';

  if (message.includes('expired')) {
    // Show resend option
    setShowResendButton(true);
  }

  showErrorMessage(message);
}
```

## Testing Email Verification

### Manual Testing

1. **Register a new user:**
```graphql
mutation {
  register(
    email: "test@example.com"
    password: "password123"
    firstName: "Test"
    lastName: "User"
  ) {
    user { id email }
    tokens { accessToken }
  }
}
```

2. **Check email** for verification link

3. **Click verification link** or extract token and use:
```graphql
mutation {
  verifyEmail(token: "extracted-token-here") {
    id
    email
    isEmailVerified
  }
}
```

4. **Try to login** - should work now

### Automated Testing

```typescript
describe('Email Verification', () => {
  it('should send verification email on registration', async () => {
    // Mock email service
    const sendEmailSpy = jest.spyOn(emailService, 'sendVerificationEmail');

    await authService.register({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(sendEmailSpy).toHaveBeenCalledWith('test@example.com', expect.any(String));
  });

  it('should verify email with valid token', async () => {
    // Create user with verification token
    const user = await userService.createUser({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    });

    const token = await userService.generateEmailVerificationToken(user.id);

    // Verify email
    const verifiedUser = await userService.verifyEmail(token);

    expect(verifiedUser.isEmailVerified).toBe(true);
  });
});
```

## Production Deployment

### Environment Variables

**Production .env:**
```env
# Use production SMTP settings
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-api-key

# Production frontend URL
FRONTEND_URL=https://yourdomain.com

# Secure JWT secrets
JWT_SECRET=your-production-jwt-secret
```

### Email Domain Setup

1. **Custom Domain:** Use your own domain for `EMAIL_FROM_ADDRESS`
2. **SPF/DKIM/DMARC:** Set up email authentication
3. **Email Templates:** Customize templates for your brand
4. **Monitoring:** Monitor email delivery rates and bounces

### Monitoring & Analytics

- **Email Delivery:** Track sent, delivered, opened, clicked
- **Verification Rates:** Monitor conversion from registration to verification
- **Bounce Handling:** Handle bounced emails appropriately
- **Spam Complaints:** Monitor and respond to spam reports

## Troubleshooting

### Emails Not Sending

**Check SMTP Configuration:**
```bash
# Test SMTP connection
telnet smtp.gmail.com 587
```

**Verify Environment Variables:**
- Check SMTP credentials
- Ensure SMTP_USER and SMTP_PASS are correct
- Verify SMTP_HOST and SMTP_PORT

**Check Logs:**
```bash
# Check application logs for email errors
docker-compose logs auth-service
```

### Verification Links Not Working

**Check Frontend URL:**
- Ensure FRONTEND_URL matches your frontend domain
- Use HTTPS in production

**Token Issues:**
- Verify tokens aren't expired (24 hours)
- Check token format (64-character hex)
- Ensure tokens aren't being truncated in emails

### Users Can't Login After Verification

**Check Database:**
```sql
SELECT email, is_email_verified, email_verification_token
FROM users WHERE email = 'user@example.com';
```

**JWT Strategy:**
- Ensure JWT strategy checks `isEmailVerified`
- Verify OAuth users are auto-verified

## Advanced Features

### Email Preferences

Future enhancement: Allow users to manage email preferences
- Marketing emails
- Order notifications
- Security alerts

### Bulk Email Operations

For future features like newsletters or announcements.

### Email Analytics

Track email engagement and user behavior.

## Support

For issues with email verification setup:

1. **Check SMTP logs** for connection errors
2. **Verify environment variables** are set correctly
3. **Test email sending** with a simple script
4. **Check spam folder** for verification emails
5. **Validate frontend URLs** for verification links

---

**Last Updated:** April 2, 2026 - Email Verification Setup Complete
