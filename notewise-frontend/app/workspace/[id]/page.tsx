"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getWorkspace,
  deleteSource,
  triggerAssetGeneration,
  pollJobStatus,
  type Workspace,
  type Source,
  type Job,
} from "@/lib/api";
import { Navbar } from "@/components/navbar";
import { WorkspaceBreadcrumb } from "@/components/workspace/workspace-breadcrumb";
import { SourceList } from "@/components/workspace/source-list";
import { SourceUploadPanel } from "@/components/workspace/source-upload-panel";
import { SummaryCard } from "@/components/workspace/summary-card";
import { AssetPanel } from "@/components/workspace/asset-panel";
import { JobStatusPanel } from "@/components/workspace/job-status-panel";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [fetching, setFetching] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/auth");
  }, [isAuthenticated, authLoading, router]);

  // ---------------------------------------------------------------------------
  // Fetch workspace
  // ---------------------------------------------------------------------------
  const fetchWorkspace = useCallback(async () => {
    const data = await getWorkspace(id);
    if (data) {
      setWorkspace(data);
      // Initialise jobs from synthesised poll
      const latestJobs = await pollJobStatus(id);
      setJobs(latestJobs);
    }
    setFetching(false);
  }, [id]);

  useEffect(() => {
    if (isAuthenticated) fetchWorkspace();
  }, [isAuthenticated, fetchWorkspace]);

  // ---------------------------------------------------------------------------
  // Poll while any source is still pending / processing
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!workspace) return;
    const hasActive = workspace.sources.some(
      (s) => s.status === "pending" || s.status === "processing",
    );
    if (!hasActive) return;

    const interval = setInterval(async () => {
      const data = await getWorkspace(id);
      if (data) {
        setWorkspace(data);
        const latestJobs = await pollJobStatus(id);
        setJobs(latestJobs);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [workspace, id]);

  // ---------------------------------------------------------------------------
  // Poll while a deepdive job is running
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const deepDiveRunning = jobs.some(
      (j) =>
        j.type === "deepdive" &&
        (j.status === "queued" || j.status === "running"),
    );
    if (!deepDiveRunning || !workspace) return;

    const interval = setInterval(async () => {
      const latestJobs = await pollJobStatus(workspace.id);
      setJobs(latestJobs);
      const completed = latestJobs.find(
        (j) => j.type === "deepdive" && j.status === "completed",
      );
      if (completed) {
        const data = await getWorkspace(workspace.id);
        if (data) setWorkspace(data);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobs, workspace]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleSourceAdded(source: Source) {
    setWorkspace((prev) => {
      if (!prev) return prev;
      const exists = prev.sources.some((s) => s.id === source.id);
      const sources = exists
        ? prev.sources.map((s) => (s.id === source.id ? source : s))
        : [...prev.sources, source];
      return { ...prev, sources };
    });
  }

  async function handleDeleteSource(sourceId: string) {
    await deleteSource(sourceId);
    fetchWorkspace();
  }

  async function handleGenerateAsset(
    assetType: "quiz" | "narration" | "video" | "deepdive",
  ) {
    if (!workspace || assetType !== "deepdive") return;
    const job = await triggerAssetGeneration(workspace.id, "deepdive");
    setJobs((prev) => [job, ...prev.filter((j) => j.type !== "deepdive")]);
  }

  async function handleRefresh() {
    const data = await getWorkspace(id);
    if (data) {
      setWorkspace(data);
      const latestJobs = await pollJobStatus(id);
      setJobs(latestJobs);
    }
  }

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------
  if (authLoading || !isAuthenticated) return null;

  if (fetching) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-6">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
        </main>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-8">
          <p className="text-muted-foreground">Workspace not found.</p>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-6">
        <WorkspaceBreadcrumb name={workspace.name} />

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Left column: Sources */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <SourceUploadPanel
              workspaceId={workspace.id}
              onSourceAdded={handleSourceAdded}
            />
            <SourceList
              sources={workspace.sources}
              onDelete={handleDeleteSource}
            />
          </div>

          {/* Right column: Summary + Assets + Job status */}
          <div className="flex flex-col gap-6 lg:col-span-3">
            <SummaryCard
              summary={workspace.latest_summary}
              workspaceId={workspace.id}
              hasSources={workspace.sources.length > 0}
            />
            <AssetPanel
              workspaceId={workspace.id}
              assets={{
                quiz: null,
                narration: null,
                video: null,
                deepdive: workspace.assets.deepdive,
              }}
              onGenerate={handleGenerateAsset}
              jobs={jobs}
            />
            <JobStatusPanel
              sources={workspace.sources}
              onRefresh={handleRefresh}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
