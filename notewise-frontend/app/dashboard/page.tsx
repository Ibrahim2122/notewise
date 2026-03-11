"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getDashboard, createWorkspace, type WorkspaceCard } from "@/lib/api";
import { Navbar } from "@/components/navbar";
import { WorkspaceCard as WorkspaceCardComponent } from "@/components/dashboard/workspace-card";
import { CreateWorkspaceModal } from "@/components/dashboard/create-workspace-modal";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FolderOpen } from "lucide-react";

export default function DashboardPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceCard[]>([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/auth");
    }
  }, [isAuthenticated, loading, router]);

  const fetchWorkspaces = useCallback(async () => {
    setFetching(true);
    const data = await getDashboard();
    setWorkspaces(data);
    setFetching(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchWorkspaces();
  }, [isAuthenticated, fetchWorkspaces]);

  // api.ts createWorkspace only accepts name — description is not yet supported
  async function handleCreate(name: string, _description: string) {
    await createWorkspace(name);
    setModalOpen(false);
    fetchWorkspaces();
  }

  const filtered = workspaces.filter((w) => {
    const q = search.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      (w.description ?? "").toLowerCase().includes(q)
    );
  });

  if (loading || (!isAuthenticated && !loading)) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your Workspaces
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize your study materials by course or topic.
          </p>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create workspace
          </Button>
        </div>

        {/* Content */}
        {fetching ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-lg border border-border bg-muted"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No workspaces found"
            description={
              search
                ? "Try a different search term."
                : "Create your first workspace to get started."
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ws) => (
              <WorkspaceCardComponent key={ws.id} workspace={ws} />
            ))}
          </div>
        )}
      </main>

      <CreateWorkspaceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
