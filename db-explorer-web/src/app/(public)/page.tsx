"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Database, Shield, Users, Zap, GitBranch, Lock, MessageSquare } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div 
            className={`inline-flex items-center gap-2 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary px-4 py-2 rounded-full text-sm font-medium transition-all duration-500 hover:bg-primary/15 dark:hover:bg-primary/25 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
              mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '0.1s' }}
            tabIndex={0}
          >
            <Zap className="w-4 h-4 animate-pulse" />
            Modern Database Management
          </div>

          <h1 
            className={`text-6xl font-bold text-foreground leading-tight transition-all duration-700 ${
              mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '0.2s' }}
          >
            Explore & Manage Your
            <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]"> Databases</span>
          </h1>

          <p 
            className={`text-xl text-muted-foreground max-w-2xl mx-auto transition-all duration-700 ${
              mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '0.3s' }}
          >
            A powerful, intuitive platform for managing MySQL, PostgreSQL, SQLite, and Supabase databases.
            Access and query your databases through natural language chat or collaborate with your team in real-time.
          </p>

          <div 
            className={`flex gap-4 justify-center pt-8 transition-all duration-700 ${
              mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '0.4s' }}
          >
            <Button 
              asChild 
              size="lg" 
              className="text-lg px-8 transition-all duration-200 hover:shadow-md hover:shadow-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button 
              asChild 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 transition-all duration-200 hover:shadow-md hover:shadow-primary/10 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Link href="/signin">Sign In</Link>
            </Button>
          </div>

          <p 
            className={`text-sm text-muted-foreground transition-all duration-700 ${
              mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: '0.5s' }}
          >
            No credit card required • Free forever • Unlimited databases
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Everything you need to manage databases
            </h2>
            <p className="text-lg text-muted-foreground">
              Powerful features designed for teams of all sizes
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div 
              className={`group relative bg-card p-6 rounded-xl shadow-sm border border-border transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:outline-none ${
                mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '0.1s' }}
              tabIndex={0}
              role="article"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/5 group-hover:to-primary/10 transition-all duration-300 rounded-xl" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 group-hover:bg-primary/20 dark:group-hover:bg-primary/30">
                  <Database className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                  Multi-Database Support
                </h3>
                <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">
                  Connect to MySQL, PostgreSQL, SQLite, and Supabase databases from a single interface.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div 
              className={`group relative bg-card p-6 rounded-xl shadow-sm border border-border transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:outline-none ${
                mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '0.15s' }}
              tabIndex={0}
              role="article"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/5 group-hover:to-primary/10 transition-all duration-300 rounded-xl" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 group-hover:bg-primary/20 dark:group-hover:bg-primary/30">
                  <Users className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                  Team Collaboration
                </h3>
                <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">
                  Invite team members with role-based permissions: Owner, Admin, Developer, Tester, or Viewer.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div 
              className={`group relative bg-card p-6 rounded-xl shadow-sm border border-border transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:outline-none ${
                mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '0.2s' }}
              tabIndex={0}
              role="article"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/5 group-hover:to-primary/10 transition-all duration-300 rounded-xl" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 group-hover:bg-primary/20 dark:group-hover:bg-primary/30">
                  <Shield className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                  Secure by Default
                </h3>
                <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">
                  Enterprise-grade security with encrypted connections and granular access control.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div 
              className={`group relative bg-card p-6 rounded-xl shadow-sm border border-border transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:outline-none ${
                mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '0.25s' }}
              tabIndex={0}
              role="article"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/5 group-hover:to-primary/10 transition-all duration-300 rounded-xl" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 group-hover:bg-primary/20 dark:group-hover:bg-primary/30">
                  <MessageSquare className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                  Chat-Based Access
                </h3>
                <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">
                  Query your databases using natural language through our AI-powered chat interface. No SQL knowledge required.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div 
              className={`group relative bg-card p-6 rounded-xl shadow-sm border border-border transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:outline-none ${
                mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '0.3s' }}
              tabIndex={0}
              role="article"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/5 group-hover:to-primary/10 transition-all duration-300 rounded-xl" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 group-hover:bg-primary/20 dark:group-hover:bg-primary/30">
                  <GitBranch className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                  Connection Sharing
                </h3>
                <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">
                  Share database connections with your team and manage who has access to what.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div 
              className={`group relative bg-card p-6 rounded-xl shadow-sm border border-border transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:outline-none ${
                mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '0.35s' }}
              tabIndex={0}
              role="article"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/5 group-hover:to-primary/10 transition-all duration-300 rounded-xl" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 group-hover:bg-primary/20 dark:group-hover:bg-primary/30">
                  <Lock className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                  Role-Based Access
                </h3>
                <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300">
                  Fine-grained permission control ensures team members only see what they need to.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <div 
          className={`max-w-4xl mx-auto bg-gradient-to-r from-primary to-primary/80 dark:from-primary dark:to-primary/70 rounded-2xl p-12 text-center text-primary-foreground relative overflow-hidden transition-all duration-700 ${
            mounted ? 'animate-fade-in opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '0.4s' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/80 animate-gradient bg-[length:200%_auto] opacity-50" />
          <div className="relative z-10">
            <h2 className="text-4xl font-bold mb-4">
              Ready to get started?
            </h2>
            <p className="text-xl mb-8 text-primary-foreground/90">
              Join thousands of developers managing their databases with DB Explorer
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                asChild 
                size="lg" 
                variant="secondary" 
                className="text-lg px-8 bg-background text-foreground hover:bg-background/90 transition-all duration-200 hover:shadow-lg hover:shadow-background/20 focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                <Link href="/signup">Start Free Trial</Link>
              </Button>
              <Button 
                asChild 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 bg-transparent border-2 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 dark:border-primary-foreground/30 dark:hover:bg-primary-foreground/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                <Link href="/signin">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
