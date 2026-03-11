"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut } from "lucide-react";

export function Navbar() {
  const { isAuthenticated, user, signOut, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight text-foreground">
            NoteWise
          </span>
        </Link>

        {!isLoading && (
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline-block">
                  {user?.name ?? user?.username}
                </span>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="mr-1.5 h-4 w-4" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
