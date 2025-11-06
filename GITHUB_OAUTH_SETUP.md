# GitHub OAuth Setup Guide

## Overview

Your application uses GitHub OAuth for authentication. This guide explains what environment variables you need and how to set them up.

## Required Environment Variables

### Backend/Supabase (`db-explorer-api`)

You need to set the following environment variables for Supabase:

```bash
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=your-github-client-id
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your-github-client-secret
```

**Where to set it:**
- Create a `.env.development` file in the `db-explorer-api` directory (for local development)
- Or set them in your Supabase project settings if using hosted Supabase

## How to Get GitHub OAuth Credentials

1. **Go to GitHub Developer Settings**
   - Visit: https://github.com/settings/developers
   - Sign in to your GitHub account

2. **Create a New OAuth App**
   - Click "New OAuth App" button
   - Fill in the application details:
     - **Application name**: Your app name (e.g., "DB Explorer")
     - **Homepage URL**: 
       - For local development: `http://localhost:3000`
       - For production: Your production domain (e.g., `https://yourdomain.com`)
     - **Authorization callback URL**: 
       - For local development: `http://localhost:54321/auth/v1/callback`
       - For production: `https://your-supabase-project.supabase.co/auth/v1/callback`
       - **Note**: This is your Supabase Auth callback URL, not your frontend URL

3. **Get Your Credentials**
   - After creating, you'll see:
     - **Client ID**: Use this for `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID`
     - **Client Secret**: Click "Generate a new client secret" and use this for `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`
     - **Important**: Save the client secret immediately - you won't be able to see it again!

## Configuration Files

### Supabase Config (`db-explorer-api/supabase/config.toml`)

The GitHub OAuth configuration has been added:

```toml
[auth.external.github]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
skip_nonce_check = false
```

### Frontend Implementation

The frontend includes:
- GitHub OAuth button in sign-in and sign-up forms
- OAuth callback handler at `/auth/callback`
- Automatic user profile creation for new GitHub users

## How It Works

1. **User clicks "Sign in with GitHub"** on the frontend
2. **Frontend** calls the backend API (`/api/auth/github/url`) to get the GitHub OAuth URL
3. **Backend** uses Supabase's `signInWithOAuth` to generate the OAuth URL
4. **User** is redirected to GitHub's authorization page
5. **GitHub** redirects back to Supabase's callback URL with an authorization code
6. **Supabase** exchanges the code for a session and redirects to your frontend callback URL (`/auth/callback`)
7. **Frontend** extracts the code from the URL and sends it to the backend (`/api/auth/github/callback`)
8. **Backend** exchanges the code for a session using Supabase
9. **Backend** checks if the user exists in your `users` table:
   - **New user**: Creates a new profile in the `users` table
   - **Existing user**: Logs them in directly
10. **Backend** returns the session tokens to the frontend
11. **Frontend** stores the tokens and redirects the user

## Important Notes

### Callback URL Configuration

The callback URL in your GitHub OAuth app must match your Supabase Auth callback URL:

- **Local Development**: `http://localhost:54321/auth/v1/callback`
  - This is your local Supabase instance's callback URL
  - Port 54321 is the default Supabase API port

- **Production**: `https://your-project-ref.supabase.co/auth/v1/callback`
  - Replace `your-project-ref` with your actual Supabase project reference
  - You can find this in your Supabase project settings

### Email Privacy Settings

GitHub users can hide their email addresses. If a user has email privacy enabled:
- The email field may be `null` or contain a GitHub-provided no-reply email
- Your application should handle this case gracefully
- Consider requesting the `user:email` scope if you need email addresses (requires app approval)

## Testing

1. Make sure all environment variables are set:
   ```bash
   cd db-explorer-api
   # Check that .env.development contains:
   # SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=...
   # SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=...
   ```

2. Start your Supabase local instance:
   ```bash
   cd db-explorer-api
   supabase start
   ```

3. Start your backend API:
   ```bash
   cd db-explorer-api
   npm run dev
   ```

4. Start your frontend:
   ```bash
   cd db-explorer-web
   npm run dev
   ```

5. Navigate to the sign-in page (`http://localhost:3000/signin`)

6. Click "Sign in with GitHub"

7. You should be redirected to GitHub's authorization page

8. After authorizing, you should be redirected back and logged in

## Troubleshooting

### "Failed to get GitHub OAuth URL" error
- Check that `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` is set correctly
- Verify Supabase is running (`supabase start`)
- Check backend logs for detailed error messages

### "Failed to authenticate with GitHub" error
- Check that Supabase environment variables are set:
  - `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID`
  - `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`
- Verify the credentials match your GitHub OAuth app settings
- Make sure the callback URL in GitHub matches your Supabase callback URL

### "No authorization code received" error
- This means GitHub didn't redirect back with a code
- Check that the callback URL in your GitHub OAuth app matches your Supabase callback URL
- Verify the callback URL is in the allowed redirect URLs

### "redirect_uri_mismatch" error
- The callback URL in your GitHub OAuth app doesn't match what Supabase is using
- For local development, ensure it's set to: `http://localhost:54321/auth/v1/callback`
- For production, use: `https://your-project-ref.supabase.co/auth/v1/callback`

### User profile not created
- Check backend logs for profile creation errors
- Verify the `users` table exists and has the correct schema
- Check that the user's email is available (GitHub email privacy may hide it)

## Security Notes

- **Never commit** your GitHub Client Secret to git
- Use environment variables for all sensitive credentials
- The Client ID can be public (it's used in the backend)
- The Client Secret must be kept private (only used in Supabase backend)
- Regularly rotate your OAuth secrets in production

## Production Deployment

When deploying to production:

1. **Update GitHub OAuth App Settings**:
   - Add your production callback URL: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Update homepage URL to your production domain

2. **Set Environment Variables**:
   - Set `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` in your production environment
   - Set `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET` in your production environment
   - Use secure secret management (e.g., AWS Secrets Manager, Azure Key Vault, etc.)

3. **Update Frontend URL**:
   - Ensure `FRONTEND_URL` environment variable is set to your production domain
   - This is used for redirects after authentication

4. **Test the Flow**:
   - Test sign-in with GitHub on production
   - Verify callback URL redirects work correctly
   - Check that user profiles are created properly

## Additional Resources

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login/auth-github)

