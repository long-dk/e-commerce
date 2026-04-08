# OAuth2 Setup Guide

This guide explains how to set up Google and GitHub OAuth2 authentication for the e-commerce platform.

## Overview

The Auth Service now supports OAuth2 authentication with Google and GitHub, allowing users to sign up and log in using their existing accounts. The service:

1. Handles OAuth2 callback URLs
2. Creates/updates user accounts automatically
3. Generates JWT tokens after OAuth2 validation
4. Publishes user-registered events to Kafka

## Google OAuth2 Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project"
3. Enter a project name (e.g., "E-Commerce Auth")
4. Wait for the project to be created

### 2. Enable the OAuth2 API

1. Search for "OAuth2.0" in the API search bar
2. Click on "Google+ API" and enable it
3. Alternatively, navigate to APIs & Services → Enable APIs and Services

### 3. Create OAuth2 Credentials

1. Go to **Credentials** in the left menu
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add redirect URIs:
   ```
   http://localhost:4001/auth/google/callback
   https://yourdomain.com/auth/google/callback  (for production)
   ```
5. Click "Create"
6. Copy your Client ID and Client Secret

### 4. Configure Environment Variables

Add to `.env`:
```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:4001/auth/google/callback
```

## GitHub OAuth2 Setup

### 1. Create a GitHub OAuth2 App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name**: E-Commerce Auth
   - **Homepage URL**: http://localhost:3000
   - **Authorization callback URL**: http://localhost:4001/auth/github/callback

### 2. Get Credentials

1. Your Client ID is visible on the app details page
2. Click "Generate a new client secret"
3. Copy both the Client ID and Client Secret

### 3. Configure Environment Variables

Add to `.env`:
```env
GITHUB_CLIENT_ID=your-client-id-here
GITHUB_CLIENT_SECRET=your-client-secret-here
GITHUB_CALLBACK_URL=http://localhost:4001/auth/github/callback
```

## Authentication Flows

### Google Login Flow

```
1. Client calls: GET /auth/google
    ↓
2. Passport redirects to Google consent screen
    ↓
3. User approves and Google redirects to callback
    ↓
4. Auth Service validates token
    ↓
5. User created/updated in database
    ↓
6. Redirects to frontend with JWT tokens:
   {FRONTEND_URL}/auth/callback?accessToken=...&refreshToken=...
    ↓
7. Frontend stores JWT for subsequent requests
```

### GitHub Login Flow

Same as Google, but with GitHub's OAuth2 endpoints.

## GraphQL Integration

### Get OAuth2 Login URLs

Use these queries to get the OAuth2 provider URLs:

```graphql
query {
  getGoogleLoginUrl
  getGithubLoginUrl
}
```

Returns:
```json
{
  "getGoogleLoginUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "getGithubLoginUrl": "https://github.com/login/oauth/authorize?client_id=..."
}
```

### Frontend Implementation Example

**React:**
```jsx
import { useQuery } from '@apollo/client';

const LOGIN_URLS = gql`
  query {
    getGoogleLoginUrl
    getGithubLoginUrl
  }
`;

function LoginButtons() {
  const { data } = useQuery(LOGIN_URLS);

  return (
    <div>
      <a href={data?.getGoogleLoginUrl}>
        Sign in with Google
      </a>
      <a href={data?.getGithubLoginUrl}>
        Sign in with GitHub
      </a>
    </div>
  );
}

// Handle OAuth callback
function AuthCallback() {
  const { accessToken, refreshToken } = new URLSearchParams(window.location.search);
  
  if (accessToken) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    window.location.href = '/';
  }
}
```

## REST Endpoints (for non-GraphQL clients)

If you need REST endpoints instead of GraphQL:

```bash
# Start Google OAuth login
GET http://localhost:4001/auth/google

# Start GitHub OAuth login
GET http://localhost:4001/auth/github

# OAuth callback (auto-handled)
GET http://localhost:4001/auth/google/callback?code=...&state=...
GET http://localhost:4001/auth/github/callback?code=...&state=...
```

## Database Changes

When a user logs in via OAuth2:

1. **First Time Login:**
   - New user created with googleId/githubId
   - Email automatically verified
   - Random password generated
   - JWT tokens returned

2. **Subsequent Logins:**
   - User found by googleId/githubId
   - Last login timestamp updated
   - JWT tokens returned
   - No password verification needed

### User Entity Fields Used

```typescript
{
  googleId?: string,    // For Google OAuth
  githubId?: string,    // For GitHub OAuth
  isEmailVerified: true, // Auto-verified for OAuth users
  lastLogin: Date,      // Updated on each login
}
```

## Security Considerations

### 1. Environment Variables

Never commit OAuth credentials to version control:
```bash
# Add to .gitignore if not already there
.env
.env.local
.env.*.local
```

### 2. HTTPS in Production

Always use HTTPS in production:
```env
# Production config
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
GITHUB_CALLBACK_URL=https://yourdomain.com/auth/github/callback
FRONTEND_URL=https://yourdomain.com
```

### 3. CSRF Protection

The OAuth2 flow includes state parameter validation (handled by Passport).

### 4. Scope Limitations

Current scopes limit what data we request:
- **Google**: `profile email` (name, photo, email)
- **GitHub**: `user:email` (username, email, public profile)

### 5. Token Rotation

- Access tokens expire in 1 hour
- Refresh tokens can be revoked
- All tokens stored securely

## Troubleshooting

### Issue: "Redirect URI mismatch"

**Solution**: Ensure the redirect URI in your OAuth provider settings exactly matches `CALLBACK_URL` in `.env`:
- Includes protocol (http:// or https://)
- Includes port if not 80/443
- No trailing slashes

### Issue: User not created after OAuth login

**Solution**: Check that:
1. User doesn't already exist (check database)
2. Email is valid
3. OAuth credentials are correct
4. Kafka connection is working (non-blocking, logs will show if it fails)

### Issue: "Invalid client_id" error

**Solution**: 
1. Verify Client ID in `.env` matches your OAuth provider
2. Ensure OAuth app is still active in provider console
3. Check if credentials were revoked

### Issue: Redirect loop

**Solution**: 
1. Verify `FRONTEND_URL` environment variable is set correctly
2. Check that frontend can receive query parameters
3. Ensure callback handler is implemented on frontend

## Kafka Integration

When a user logs in via OAuth2, a `user-registered` event is published:

```typescript
{
  userId: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  createdAt: "2026-04-02T13:00:00Z"
}
```

Other services can subscribe to this event:

```typescript
async onModuleInit() {
  await this.kafkaService.subscribeToTopic(
    'user-registered',
    async (message) => {
      const event = JSON.parse(message.value.toString());
      // Handle new OAuth user registration
    },
  );
}
```

## Testing OAuth Locally

### Method 1: Manual Testing

1. Access `http://localhost:4001/auth/google`
2. Authenticate with your Google account
3. You'll be redirected with tokens in the URL

### Method 2: Using OAuth Authorization Provider

For testing without actual OAuth providers, you can:

1. Mock the strategies in tests
2. Use Passport's testing utilities
3. Send fake user objects through the pipe

### Method 3: Postman

You can use Postman to test OAuth flows:
1. Create a Postman OAuth2 authorization
2. Set Auth URL and Token URL
3. Paste your Client ID/Secret
4. Get fresh tokens for testing

## Advanced Configuration

### Custom User Data Mapping

To map additional OAuth profile data to user fields:

1. Modify `google.strategy.ts` or `github.strategy.ts`
2. Add additional fields to the user object before save
3. Update User entity if needed

Example:
```typescript
const user = await this.userService.createUser({
  email,
  firstName,
  lastName,
  googleId: id,
  phone: profile.phoneNumbers?.[0]?.value, // Add if Phone field exists
});
```

### Multiple OAuth Strategies

To add more OAuth providers (Facebook, LinkedIn, etc.):

1. Install strategy: `npm install passport-facebook`
2. Create `facebook.strategy.ts` (similar to google/github)
3. Register in auth-service.module.ts
4. Update User entity with facebookId field
5. Add GraphQL query for login URL

## Complete Example: Role-Based OAuth Login

```typescript
// In google.strategy.ts
const user = await this.userService.createUser({
  email,
  firstName,
  lastName,
  googleId: id,
  role: email.endsWith('@company.com') ? 'seller' : 'user', // Domain-based roles
});
```

## Support

For issues with OAuth2 setup:

1. Check provider documentation:
   - [Google OAuth2 Docs](https://developers.google.com/identity)
   - [GitHub OAuth Docs](https://docs.github.com/en/developers/apps/building-oauth-apps)

2. Enable debug logging:
   ```env
   LOG_LEVEL=debug
   ```

3. Check Kafka logs for event publishing errors

---

**Last Updated:** April 2, 2026 - OAuth2 Enhancement
