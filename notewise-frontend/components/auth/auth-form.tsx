"use client"

import React from "react"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"

export function AuthForm() {
  const { login, register } = useAuth()
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regName, setRegName] = useState("")
  const [error, setError] = useState("")

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!loginEmail || !loginPassword) {
      setError("Please fill in all fields.")
      return
    }
    login(loginEmail)
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!regName || !regEmail || !regPassword) {
      setError("Please fill in all fields.")
      return
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    register(regEmail)
  }

  return (
    <Tabs defaultValue="login" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Sign in</TabsTrigger>
        <TabsTrigger value="register">Register</TabsTrigger>
      </TabsList>

      <TabsContent value="login">
        <Card className="border border-border">
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="register">
        <Card className="border border-border">
          <CardContent className="pt-6">
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-name">Full name</Label>
                <Input
                  id="reg-name"
                  type="text"
                  placeholder="Jane Doe"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Create account
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
