import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getFrontendUrl } from '../utils/environment.js';

// Load environment variables from single .env file
dotenv.config();

const environment = process.env.NODE_ENV || 'development';

// Production environment warning
if (environment === 'production') {
  console.log('🚨 PRODUCTION ENVIRONMENT - USE WITH CAUTION 🚨');
  console.log(`Database: ${process.env.SUPABASE_URL?.slice(0, 30)}...`);
}

// Types for different client configurations
export interface SupabaseConfig {
  url: string;
  key: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
    db?: {
      schema?: string;
    };
    global?: {
      headers?: Record<string, string>;
    };
  };
}

// Client factory class following industry best practices
class SupabaseClientFactory {
  private static instance: SupabaseClientFactory;
  private adminClient: SupabaseClient | null = null;
  private publicClient: SupabaseClient | null = null;
  private readonly config: {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
  };

  private constructor() {
    // Validate environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error('Missing SUPABASE_URL environment variable');
    }
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    }
    if (!supabaseAnonKey) {
      throw new Error('Missing SUPABASE_ANON_KEY environment variable');
    }

    this.config = {
      url: supabaseUrl,
      serviceRoleKey: supabaseServiceKey,
      anonKey: supabaseAnonKey,
    };
  }

  // Singleton instance getter with lazy initialization
  public static getInstance(): SupabaseClientFactory {
    if (!SupabaseClientFactory.instance) {
      SupabaseClientFactory.instance = new SupabaseClientFactory();
    }
    return SupabaseClientFactory.instance;
  }

  /**
   * Get admin client with service role key (bypasses RLS)
   * Used for server-side operations that need elevated privileges
   */
  public getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      this.adminClient = createClient(this.config.url, this.config.serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'X-Client-Info': 'supabase-admin-client',
          },
        },
      });

      // Log successful initialization
      console.log('✅ Supabase Admin Client initialized successfully');
    }
    return this.adminClient;
  }

  /**
   * Get public client with anonymous key (respects RLS)
   * Used for user-authenticated operations
   */
  public getPublicClient(): SupabaseClient {
    if (!this.publicClient) {
      this.publicClient = createClient(this.config.url, this.config.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // Server-side should not detect URLs
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'X-Client-Info': 'supabase-public-client',
          },
        },
      });

      // Log successful initialization  
      console.log('✅ Supabase Public Client initialized successfully');
    }
    return this.publicClient;
  }

  /**
   * Create a custom client with specific configuration
   * Use sparingly - prefer getAdminClient() or getPublicClient()
   */
  public createCustomClient(config: SupabaseConfig): SupabaseClient<any, string, any> {
    console.log('⚠️  Creating custom Supabase client - consider using getAdminClient() or getPublicClient()');
    return createClient(config.url, config.key, config.options);
  }

  /**
   * Health check method to verify connectivity
   */
  public async healthCheck(): Promise<{ admin: boolean; public: boolean }> {
    const results = { admin: false, public: false };

    try {
      // Test admin client
      const adminClient = this.getAdminClient();
      const { error: adminError } = await adminClient.from('user').select('id').limit(1);
      results.admin = !adminError;
    } catch (error) {
      console.error('Admin client health check failed:', error);
    }

    try {
      // Test public client
      const publicClient = this.getPublicClient();
      const { error: publicError } = await publicClient.from('user').select('id').limit(1);
      results.public = !publicError;
    } catch (error) {
      console.error('Public client health check failed:', error);
    }

    return results;
  }

  /**
   * Reset clients (useful for testing or configuration changes)
   */
  public reset(): void {
    this.adminClient = null;
    this.publicClient = null;
    console.log('🔄 Supabase clients reset');
  }
}

// Export factory instance and convenience methods
const supabaseFactory = SupabaseClientFactory.getInstance();

// Main exports - these should be used throughout the application
export const supabaseAdmin = supabaseFactory.getAdminClient();
export const supabasePublic = supabaseFactory.getPublicClient();

// Export factory for advanced use cases
export { supabaseFactory };

// Export types
export type { SupabaseClient };

// Helper functions for common operations
export const getSupabaseAdmin = () => supabaseFactory.getAdminClient();
export const getSupabasePublic = () => supabaseFactory.getPublicClient();

// Health check export
export const checkSupabaseHealth = () => supabaseFactory.healthCheck();

// Google OAuth helper functions for backend use
export const getGoogleOAuthUrl = (redirectTo?: string) => {
  const client = supabaseFactory.getPublicClient();
  return client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || `${getFrontendUrl()}/auth/callback`,
    },
  });
};

export const handleGoogleOAuthCallback = async (code: string) => {
  const client = supabaseFactory.getPublicClient();
  return client.auth.exchangeCodeForSession(code);
};

// GitHub OAuth helper functions for backend use
export const getGitHubOAuthUrl = (redirectTo?: string) => {
  const client = supabaseFactory.getPublicClient();
  return client.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: redirectTo || `${getFrontendUrl()}/auth/callback`,
      skipBrowserRedirect: false, // Ensure browser redirect happens
    },
  });
};

export const handleGitHubOAuthCallback = async (code: string) => {
  const client = supabaseFactory.getPublicClient();
  return client.auth.exchangeCodeForSession(code);
};