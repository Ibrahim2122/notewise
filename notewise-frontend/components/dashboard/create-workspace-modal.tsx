"use client"

import React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreateWorkspaceModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description: string) => void
}

export function CreateWorkspaceModal({ open, onClose, onCreate }: CreateWorkspaceModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    await onCreate(name.trim(), description.trim())
    setName("")
    setDescription("")
    setCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Give your workspace a name and optional description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              placeholder="e.g., Biology 101"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ws-desc">Description</Label>
            <Input
              id="ws-desc"
              placeholder="Short description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
