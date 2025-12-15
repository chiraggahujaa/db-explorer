"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyProfile } from "@/features/profile/hooks/useProfile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { data: myProfileRes } = useMyProfile();
  const myProfile = myProfileRes?.data;
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Use profile fullName if available, fallback to auth name
  const displayName = myProfile?.fullName || user?.name || "User";
  const avatarUrl = myProfile?.avatarUrl;

  const initials = useMemo(() => {
    return (
      displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("") || "U"
    );
  }, [displayName]);

  return (
    <header
      data-scrolled={scrolled}
      className="fixed top-0 inset-x-0 z-50 transition-all bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 border-b border-border/40 data-[scrolled=true]:border-border/80 shadow-sm"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Left: Logo */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href="/" className="shrink-0 flex items-center">
              <picture>
                <source srcSet="/logo-40.png" media="(min-width: 640px)" />
                <img
                  src="/logo-32.png"
                  alt="DB Explorer"
                  className="h-8 w-8 sm:h-10 sm:w-10"
                  width={32}
                  height={32}
                />
              </picture>
            </Link>
          </div>

          {/* Right: Auth */}
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            {isAuthenticated && (
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" aria-label="Dashboard">
                  <LayoutDashboard className="size-5" />
                </Button>
              </Link>
            )}
            {!isAuthenticated && (
              <div className="hidden sm:flex items-center gap-2 pl-2">
                <Link href="/signin">
                  <Button variant="outline" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Sign up</Button>
                </Link>
              </div>
            )}

            {isAuthenticated && (
              <div
                className="pl-1"
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <DropdownMenu
                  open={userMenuOpen}
                  onOpenChange={setUserMenuOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 gap-2 pr-3">
                      <Avatar>
                        <AvatarImage
                          src={avatarUrl || undefined}
                          alt={displayName}
                        />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <span className="max-w-[8rem] truncate">
                        {displayName}
                      </span>
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
                    <div className="px-2 pb-2 text-sm text-muted-foreground truncate">
                      {displayName}
                    </div>
                    <DropdownMenuSeparator />
                    <Link href={user?.id ? `/profile/${user.id}` : "/signin"}>
                      <DropdownMenuItem>Profile</DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem onClick={() => logout()}>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
