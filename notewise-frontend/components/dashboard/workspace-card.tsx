"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { WorkspaceCard as WorkspaceCardType } from "@/lib/api";

interface WorkspaceCardProps {
  workspace: WorkspaceCardType;
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  return (
    <Link href={`/workspace/${workspace.id}`}>
      <Card className="group cursor-pointer border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors line-clamp-1">
              {workspace.name}
            </h3>
          </div>

          {workspace.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {workspace.description}
            </p>
          )}

          <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {workspace.source_count}{" "}
              {workspace.source_count === 1 ? "source" : "sources"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {workspace.created_at
                ? formatDistanceToNow(new Date(workspace.created_at), {
                    addSuffix: true,
                  })
                : "recently"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
