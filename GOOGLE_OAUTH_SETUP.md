# Google OAuth Setup Guide

## Overview

Your application uses Google OAuth for authentication. This guide explains what environment variables you need and how to set them up.

## Required Environment Variables

### Frontend (`db-explorer-web`)

You need to set the following environment variable:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Where to set it:**
- Create a `.env.local` file in the `db-explorer-web` directory
- Or set it in your deployment platform's environment variables

### Backend/Supabase (`db-explorer-api`)

You need to set the following environment variables for Supabase:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-google-client-secret
```

**Where to set it:**
- Create a `.env.development` file in the `db-explorer-api` directory (for local development)
- Or set them in your Supabase project settings if using hosted Supabase

## How to Get Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select an existing one

2. **Enable Google+ API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
   - Also enable "Google Identity Services API"

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application" as the application type
   - Configure:
     - **Name**: Your app name (e.g., "DB Explorer")
     - **Authorized JavaScript origins**:
       - `http://localhost:3000` (for local development)
       - Your production domain (e.g., `https://yourdomain.com`)
     - **Authorized redirect URIs**:
       - `http://localhost:3000` (for local development)
       - `http://localhost:3000/auth/callback` (if using redirect flow)
       - Your production callback URLs

4. **Get Your Credentials**
   - After creating, you'll see:
     - **Client ID**: Use this for `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
     - **Client Secret**: Use this for `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`

## Configuration Files

### Supabase Config (`db-explorer-api/supabase/config.toml`)

The Google OAuth configuration has been added:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
skip_nonce_check = true
```

### Frontend Provider (`db-explorer-web/src/providers/QueryProvider.tsx`)

The frontend already uses the Google OAuth provider:

```typescript
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
<GoogleOAuthProvider clientId={googleClientId}>
```

## How It Works

1. **User clicks "Sign in with Google"** on the frontend
2. **Frontend** uses `@react-oauth/google` to get an ID token from Google
3. **Frontend** sends the ID token to your backend API (`/api/auth/google/auth`)
4. **Backend** uses Supabase's `signInWithIdToken` to authenticate the user
5. **Backend** checks if the user exists in your `users` table:
   - **New user**: Creates a new profile in the `users` table
   - **Existing user**: Logs them in directly
6. **Backend** returns the session tokens to the frontend
7. **Frontend** stores the tokens and redirects the user

## Testing

1. Make sure all environment variables are set
2. Start your Supabase local instance: `supabase start` (in `db-explorer-api`)
3. Start your frontend: `npm run dev` (in `db-explorer-web`)
4. Navigate to the sign-in page
5. Click "Sign in with Google"
6. You should be redirected to Google's sign-in page
7. After signing in, you should be redirected back and logged in

## Troubleshooting

### "Google sign-in failed" error
- Check that `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set correctly
- Verify the Google OAuth credentials are correct
- Check browser console for detailed error messages

### "Failed to authenticate with Google" error
- Check that Supabase environment variables are set:
  - `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
  - `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
- Verify the credentials match your Google Cloud Console settings
- Make sure Supabase is running (`supabase start`)

### "ID token is required" error
- This means the frontend isn't sending the token correctly
- Check that `@react-oauth/google` is properly configured
- Verify the `GoogleOAuthProvider` has the correct `clientId`

## Security Notes

- **Never commit** your Google Client Secret to git
- Use environment variables for all sensitive credentials
- The Client ID can be public (it's used in the frontend)
- The Client Secret must be kept private (only used in Supabase backend)

