"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthPage() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome to NoteWise
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to access your study workspaces
            </p>
          </div>

          <Button className="w-full" size="lg" onClick={signIn}>
            Sign in with Google or Microsoft
          </Button>
        </div>
      </main>
    </div>
  );
}
