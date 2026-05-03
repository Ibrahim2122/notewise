"use client"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"

export function AuthForm() {
  const { signIn } = useAuth()

  return (
    <Button onClick={() => signIn()} className="w-full">
      Sign in with Microsoft
    </Button>
  )
}
