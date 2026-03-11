"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getWorkspace,
  triggerAssetGeneration,
  pollJobStatus,
  type Workspace,
  type Job,
} from "@/lib/api";
import { Navbar } from "@/components/navbar";
import { DeepDiveRenderer } from "@/components/workspace/deep-dive-renderer";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  BookOpen,
  Copy,
  Check,
  ArrowLeft,
  RefreshCw,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// TOC extraction from TSX content
// ---------------------------------------------------------------------------

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Extract headings from TSX/HTML source to build a TOC */
function extractTocFromTsx(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  // Match <h2>...</h2>, <h3>...</h3> etc — handles multiline and attributes
  const headingRe = /<(h[123])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    // Strip any nested tags to get plain text
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (!text) continue;
    const level = parseInt(tag[1]);
    entries.push({ id: slugify(text), text, level });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DeepDivePage({
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
  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/auth");
  }, [isAuthenticated, authLoading, router]);

  const fetchWorkspace = useCallback(async () => {
    const data = await getWorkspace(id);
    if (data) {
      setWorkspace(data);
      const latestJobs = await pollJobStatus(id);
      setJobs(latestJobs);
    }
    setFetching(false);
  }, [id]);

  useEffect(() => {
    if (isAuthenticated) fetchWorkspace();
  }, [isAuthenticated, fetchWorkspace]);

  // Poll while deepdive job is running
  useEffect(() => {
    if (!workspace) return;
    const deepDiveJob = jobs.find(
      (j) =>
        j.type === "deepdive" &&
        (j.status === "queued" || j.status === "running"),
    );
    if (!deepDiveJob) return;

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
  }, [workspace, jobs]);

  // Active heading tracking via postMessage from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "activeHeading" && typeof e.data.id === "string") {
        setActiveId(e.data.id);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function handleGenerate() {
    if (!workspace) return;
    const job = await triggerAssetGeneration(workspace.id, "deepdive");
    setJobs((prev) => [job, ...prev.filter((j) => j.type !== "deepdive")]);
  }

  function handleCopy() {
    const content = workspace?.assets.deepdive;
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (authLoading || !isAuthenticated) return null;

  const deepdiveContent = workspace?.assets.deepdive ?? null;

  // Clean fences before TOC extraction
  const cleanedContent = deepdiveContent
    ? deepdiveContent
        .replace(/^```(?:tsx|jsx|typescript|javascript)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim()
    : null;

  const toc: TocEntry[] = cleanedContent
    ? extractTocFromTsx(cleanedContent)
    : [];

  const isGenerating = jobs.some(
    (j) =>
      j.type === "deepdive" &&
      (j.status === "queued" || j.status === "running"),
  );
  const lastGenJob = jobs.find(
    (j) => j.type === "deepdive" && j.status === "completed",
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground"
          >
            Workspaces
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href={`/workspace/${id}`}
            className="transition-colors hover:text-foreground"
          >
            {workspace?.name ?? "Workspace"}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">Concept Deep Dive</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/workspace/${id}`}>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Concept Deep Dive
                </h1>
                <p className="text-xs text-muted-foreground">
                  Long-form documentation expanding on your Study Summary
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deepdiveContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy all
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant={deepdiveContent ? "outline" : "default"}
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-1.5 text-xs"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : deepdiveContent ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </>
              ) : (
                "Generate deep dive"
              )}
            </Button>
          </div>
        </div>

        {/* Loading skeleton */}
        {fetching && (
          <div className="flex gap-10">
            <div className="hidden w-52 shrink-0 lg:block">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 animate-pulse rounded bg-muted"
                    style={{ width: `${60 + ((i * 13) % 40)}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
            </div>
          </div>
        )}

        {/* Generating state — no content yet */}
        {!fetching && isGenerating && !deepdiveContent && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-24">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:200ms]" />
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:400ms]" />
            </div>
            <p className="text-base font-medium text-foreground">
              Generating your deep dive...
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Analyzing your sources to create a comprehensive document. This
              may take a moment.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!fetching && !isGenerating && !deepdiveContent && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-24">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-base font-medium text-foreground">
              No deep dive generated yet
            </p>
            <p className="mt-1.5 max-w-md text-center text-sm text-muted-foreground">
              Generate a long-form explanation that expands on your Study
              Summary with historical context, detailed analysis, and practical
              applications.
            </p>
            <Button onClick={handleGenerate} className="mt-6 gap-1.5" size="sm">
              <BookOpen className="h-4 w-4" />
              Generate deep dive
            </Button>
          </div>
        )}

        {/* Content — original layout: TOC sidebar + main content, no box wrapper */}
        {!fetching && cleanedContent && (
          <div className="flex gap-10">
            {/* TOC sidebar */}
            {toc.length > 1 && (
              <aside className="hidden w-52 shrink-0 lg:block">
                <div className="sticky top-20">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    On this page
                  </p>
                  <nav className="flex flex-col gap-0.5">
                    {toc.map((entry) => (
                      <a
                        key={entry.id}
                        href={`#${entry.id}`}
                        className={cn(
                          "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          entry.level === 1 && "font-medium",
                          entry.level === 2 && "pl-4",
                          entry.level === 3 && "pl-7 text-xs",
                          activeId === entry.id
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {entry.text}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>
            )}

            {/* Main content */}
            <div ref={contentRef} className="min-w-0 flex-1">
              {isGenerating && (
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-sm text-primary">
                    Regenerating... The content below will update shortly.
                  </span>
                </div>
              )}

              <DeepDiveRenderer tsxContent={cleanedContent} />

              {lastGenJob && (
                <div className="mt-12 flex items-center gap-2 border-t border-border pt-6 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Last generated{" "}
                    {new Date(lastGenJob.updatedAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
