import { Request, Response } from 'express';
import { supabaseAdmin, getGitHubOAuthUrl, handleGitHubOAuthCallback } from '../lib/supabase.js';
import { createUserProfile, isEmailTaken } from '../utils/database.js';
import { UserService } from '../services/UserService.js';
import { getFrontendUrl } from '../utils/environment.js';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.json({
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const { name, email, password } = req.body;

      // Uniqueness checks in our DB (users table)
      if (email) {
        const taken = await isEmailTaken(email);
        if (taken) {
          return res.status(409).json({ success: false, error: 'Email already exists' });
        }
      }

      const { data, error } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
          emailRedirectTo: `${getFrontendUrl()}/verify-email`,
        },
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      // Create user profile if user was successfully created
      if (data.user) {
        try {
          const profileResult = await createUserProfile(data.user.id, {
            name,
            email,
            email_confirmed_at: data.user.email_confirmed_at,
          });

          if (profileResult.error) {
            console.error('Profile creation error:', profileResult.error);
          } else {
            console.log('User profile created successfully:', profileResult.data);
          }
        } catch (profileError) {
          console.error('Profile creation exception:', profileError);
        }
      }

      res.json({
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
        message: data.user?.email_confirmed_at 
          ? 'Registration successful' 
          : 'Registration successful. Please check your email to verify your account.',
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No token provided',
        });
      }

      // Sign out the specific session
      const { error } = await supabaseAdmin.auth.admin.signOut(token);

      if (error) {
        // Even if there's an error, we might want to consider the logout successful
        // from the client's perspective if the token is invalid
        console.warn('Logout warning:', error.message);
      }

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      // User should be attached to req by the authenticateToken middleware
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const userService = new UserService();
      const result = await userService.getUserById(user.id);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || null,
            emailConfirmedAt: user.email_confirmed_at,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
          profile: result.success ? result.data : null,
        },
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
      }

      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        return res.status(401).json({
          success: false,
          error: error.message,
        });
      }

      res.json({
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async verifyEmail(req: Request, res: Response) {
    try {
      const { token, type, email } = req.body;

      if (!token || !type) {
        return res.status(400).json({
          success: false,
          error: 'Token and type are required',
        });
      }

      // Prepare verification parameters based on type
      let verifyParams: any = { token, type };
      
      if (type === 'email' && email) {
        verifyParams.email = email;
      }

      const { data, error } = await supabaseAdmin.auth.verifyOtp(verifyParams);

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.json({
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
        message: 'Email verified successfully',
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
        });
      }

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${getFrontendUrl()}/reset-password`,
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.json({
        success: true,
        message: 'Password reset email sent successfully',
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async updatePassword(req: Request, res: Response) {
    try {
      const { password } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long',
        });
      }

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password }
      );

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.json({
        success: true,
        message: 'Password updated successfully',
        data: {
          user: data.user,
        },
      });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // Unified Google Authentication (handles both sign-in and sign-up)
  static async authenticateWithGoogle(req: Request, res: Response) {
    try {
      const { accessToken, idToken } = req.body as { accessToken?: string; idToken?: string };

      if (!idToken) {
        return res.status(400).json({
          success: false,
          error: 'ID token is required',
        });
      }

      // Authenticate with Google using Supabase
      const params: any = { provider: 'google', token: idToken };
      if (accessToken && accessToken.length > 0) params.access_token = accessToken;
      const { data, error } = await supabaseAdmin.auth.signInWithIdToken(params);

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      // Check if user already exists in our users table to determine if this is sign-in or sign-up
      let isNewUser = false;
      if (data.user) {
        if (data.user.email) {
          const emailExists = await isEmailTaken(data.user.email);
          isNewUser = !emailExists;
        }

        // For OAuth providers, email is automatically verified
        const emailVerified = true;

        // If it's a new user, create profile
        if (isNewUser) {
          try {
            console.log('Creating profile for new Google user:', data.user.id);

            const profileResult = await createUserProfile(data.user.id, {
              name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'Google User',
              email: data.user.email,
              avatar_url: data.user.user_metadata?.avatar_url || null,
              email_confirmed_at: data.user.email_confirmed_at,
              email_verified: emailVerified,
            });

            if (profileResult.error) {
              console.error('Google user profile creation error:', profileResult.error);
            } else {
              console.log('Google user profile created successfully:', profileResult.data);

              // Update user metadata to mark profile as created
              await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
                user_metadata: {
                  ...data.user.user_metadata,
                  profile_created: true,
                  provider: 'google',
                }
              });
            }
          } catch (profileError) {
            console.error('Google profile creation exception:', profileError);
          }
        } else {
          // For existing users, update email_verified to true if not already verified
          try {
            const { data: userData } = await supabaseAdmin
              .from('users')
              .select('email_verified')
              .eq('id', data.user.id)
              .single();
            
            if (userData && !userData.email_verified) {
              await supabaseAdmin
                .from('users')
                .update({ email_verified: true })
                .eq('id', data.user.id);
              console.log('Updated email_verified for existing Google user:', data.user.id);
            }
          } catch (updateError) {
            console.error('Error updating email_verified for existing Google user:', updateError);
          }
        }
      }

      res.json({
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
        message: isNewUser
          ? 'Welcome! Your account has been created successfully'
          : 'Welcome back! Signed in successfully',
      });
    } catch (error) {
      console.error('Google authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to authenticate with Google',
      });
    }
  }

  static async resendVerificationEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
        });
      }

      const { error } = await supabaseAdmin.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${getFrontendUrl()}/verify-email`,
        },
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.json({
        success: true,
        message: 'Verification email sent successfully',
      });
    } catch (error) {
      console.error('Resend verification email error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // Get GitHub OAuth URL
  static async getGitHubOAuthUrl(req: Request, res: Response) {
    try {
      const { redirectTo } = req.query;
      const redirectUrl = redirectTo ? String(redirectTo) : `${getFrontendUrl()}/auth/callback`;
      
      const { data, error } = await getGitHubOAuthUrl(redirectUrl);

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.json({
        success: true,
        data: {
          url: data.url,
        },
      });
    } catch (error) {
      console.error('GitHub OAuth URL error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get GitHub OAuth URL',
      });
    }
  }

  // Handle GitHub OAuth callback
  static async handleGitHubCallback(req: Request, res: Response) {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Authorization code is required',
        });
      }

      // Exchange code for session
      const { data, error } = await handleGitHubOAuthCallback(code);

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      // Check if user already exists in our users table
      let isNewUser = false;
      if (data.user) {
        if (data.user.email) {
          const emailExists = await isEmailTaken(data.user.email);
          isNewUser = !emailExists;
        }

        // For OAuth providers, email is automatically verified
        const emailVerified = true;

        // If it's a new user, create profile
        if (isNewUser) {
          try {
            console.log('Creating profile for new GitHub user:', data.user.id);

            const profileResult = await createUserProfile(data.user.id, {
              name: data.user.user_metadata?.full_name || 
                    data.user.user_metadata?.name || 
                    data.user.user_metadata?.user_name ||
                    'GitHub User',
              email: data.user.email,
              avatar_url: data.user.user_metadata?.avatar_url || null,
              email_confirmed_at: data.user.email_confirmed_at,
              email_verified: emailVerified,
            });

            if (profileResult.error) {
              console.error('GitHub user profile creation error:', profileResult.error);
            } else {
              console.log('GitHub user profile created successfully:', profileResult.data);

              // Update user metadata to mark profile as created
              await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
                user_metadata: {
                  ...data.user.user_metadata,
                  profile_created: true,
                  provider: 'github',
                }
              });
            }
          } catch (profileError) {
            console.error('GitHub profile creation exception:', profileError);
          }
        } else {
          // For existing users, update email_verified to true if not already verified
          try {
            const { data: userData } = await supabaseAdmin
              .from('users')
              .select('email_verified')
              .eq('id', data.user.id)
              .single();
            
            if (userData && !userData.email_verified) {
              await supabaseAdmin
                .from('users')
                .update({ email_verified: true })
                .eq('id', data.user.id);
              console.log('Updated email_verified for existing GitHub user:', data.user.id);
            }
          } catch (updateError) {
            console.error('Error updating email_verified for existing GitHub user:', updateError);
          }
        }
      }

      res.json({
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
        message: isNewUser
          ? 'Welcome! Your account has been created successfully'
          : 'Welcome back! Signed in successfully',
      });
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to authenticate with GitHub',
      });
    }
  }
}