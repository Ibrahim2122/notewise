"use client";

/**
 * components/workspace/job-status-panel.tsx
 *
 * Shows live processing status for all sources in the workspace.
 * Replaces the mock Job-based panel — since the backend tracks status
 * on Source rows (pending → processing → done/failed), we display that
 * directly rather than a separate jobs table that doesn't exist yet.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  RefreshCw,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Source, SourceStatus } from "@/lib/api";

// ─── Status helpers ──────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: SourceStatus }) {
  switch (status) {
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    case "processing":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  }
}

const statusBadgeVariant: Record<
  SourceStatus,
  "outline" | "default" | "secondary" | "destructive"
> = {
  pending: "outline",
  processing: "secondary",
  done: "default",
  failed: "destructive",
};

const statusLabel: Record<SourceStatus, string> = {
  pending: "Queued",
  processing: "Processing",
  done: "Done",
  failed: "Failed",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface JobStatusPanelProps {
  sources: Source[];
  onRefresh: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function JobStatusPanel({ sources, onRefresh }: JobStatusPanelProps) {
  // Only show sources that have been submitted for processing
  const activeSources = sources.filter(
    (s) => s.status !== "pending" || s.storage_uri,
  );

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Processing Status
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activeSources.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Upload a source to see processing status here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {activeSources.map((source) => {
              const displayType =
                source.type ?? source.source_type ?? "unknown";
              const displayDate = source.addedAt ?? source.created_at;
              return (
                <li
                  key={source.id}
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5"
                >
                  <StatusIcon status={source.status} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {source.name ??
                          source.title ??
                          source.original_filename ??
                          "Untitled"}
                      </span>
                      <Badge
                        variant={statusBadgeVariant[source.status]}
                        className="shrink-0 text-[10px]"
                      >
                        {statusLabel[source.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {displayType.toUpperCase()} · added{" "}
                      {displayDate
                        ? formatDistanceToNow(new Date(displayDate), {
                            addSuffix: true,
                          })
                        : "just now"}
                    </p>
                  </div>

                  {source.status === "processing" && (
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:600ms]" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
