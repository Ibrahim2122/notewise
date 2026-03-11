import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  FileText,
  Link as LinkIcon,
  Mic,
  Layers,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { deleteSource, type Source, type SourceStatus } from "@/lib/api";

const typeIcons: Record<string, React.ElementType> = {
  pdf: FileText,
  text: FileText,
  url: LinkIcon,
  audio: Mic,
};

const typeColors: Record<string, string> = {
  pdf: "bg-destructive/10 text-destructive",
  text: "bg-muted text-muted-foreground",
  url: "bg-primary/10 text-primary",
  audio: "bg-green-500/10 text-green-600 dark:text-green-400",
};

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

interface SourceListProps {
  sources: Source[];
  /** Called after a source is successfully deleted */
  onDelete: (sourceId: string) => void;
}

export function SourceList({ sources, onDelete }: SourceListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(sourceId: string) {
    setDeletingId(sourceId);
    try {
      await deleteSource(sourceId);
      onDelete(sourceId);
    } catch (err) {
      console.error("Failed to delete source", err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Sources</span>
          <Badge variant="secondary" className="text-xs font-normal">
            {sources.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sources.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No sources yet"
            description="Add your first source above to get started."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {sources.map((source) => {
              const Icon = typeIcons[source.type] ?? FileText;
              const isDeleting = deletingId === source.id;
              const addedAt = source.addedAt
                ? formatDistanceToNow(new Date(source.addedAt), {
                    addSuffix: true,
                  })
                : "recently";

              return (
                <li
                  key={source.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${typeColors[source.type] ?? "bg-muted text-muted-foreground"}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {source.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{addedAt}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusIcon status={source.status} />
                    <Badge
                      variant={statusBadgeVariant[source.status]}
                      className="text-[10px] uppercase"
                    >
                      {source.status}
                    </Badge>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(source.id)}
                    disabled={isDeleting}
                    title="Remove source"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
