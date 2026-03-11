"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BrainCircuit,
  Mic,
  Video,
  Sparkles,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import type { Job } from "@/lib/api";

interface AssetPanelProps {
  workspaceId: string;
  assets: {
    quiz: string | null;
    narration: string | null;
    video: string | null;
    deepdive: string | null;
  };
  onGenerate: (type: "quiz" | "narration" | "video" | "deepdive") => void;
  jobs: Job[];
}

const assetConfig = [
  {
    key: "quiz" as const,
    label: "Quiz",
    icon: BrainCircuit,
    description: "Generate study questions from your sources",
  },
  {
    key: "narration" as const,
    label: "Narration",
    icon: Mic,
    description: "Create an audio summary of key concepts",
  },
  {
    key: "video" as const,
    label: "Short Video",
    icon: Video,
    description: "Generate an animated concept explainer",
  },
];

export function AssetPanel({
  workspaceId,
  assets,
  onGenerate,
  jobs,
}: AssetPanelProps) {
  function getJobForAsset(type: string) {
    return jobs.find(
      (j) =>
        j.type === type && j.status !== "completed" && j.status !== "failed",
    );
  }

  const deepDiveJob = getJobForAsset("deepdive");
  const isDeepDiveRunning = !!deepDiveJob;
  const hasDeepDiveContent = !!assets.deepdive;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Generated Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {assetConfig.map((asset) => {
              const activeJob = getJobForAsset(asset.key);
              const isRunning = !!activeJob;
              const hasContent = !!assets[asset.key];

              return (
                <div
                  key={asset.key}
                  className="flex flex-col rounded-lg border border-border bg-secondary/20 p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                      <asset.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {asset.label}
                    </span>
                  </div>

                  {isRunning ? (
                    <div className="mb-3 flex items-center gap-2 rounded bg-primary/5 px-2.5 py-1.5">
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      <span className="text-xs text-primary">
                        {activeJob.status === "queued"
                          ? "Queued"
                          : "Generating"}
                      </span>
                    </div>
                  ) : hasContent ? (
                    <div className="mb-3 rounded-md bg-muted/50 p-2.5">
                      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {assets[asset.key]}
                      </p>
                    </div>
                  ) : (
                    <p className="mb-3 text-xs text-muted-foreground">
                      {asset.description}
                    </p>
                  )}

                  <Button
                    size="sm"
                    variant={hasContent ? "outline" : "default"}
                    onClick={() => onGenerate(asset.key)}
                    disabled={isRunning}
                    className="mt-auto w-full text-xs"
                  >
                    {isRunning
                      ? "Processing..."
                      : hasContent
                        ? "Regenerate"
                        : "Generate"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Concept Deep Dive -- compact trigger card */}
      <Card className="border border-border transition-colors hover:border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Concept Deep Dive
                </h3>
                {hasDeepDiveContent && (
                  <Badge variant="secondary" className="text-[10px]">
                    Generated
                  </Badge>
                )}
                {isDeepDiveRunning && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    {deepDiveJob!.status === "queued" ? "Queued" : "Generating"}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hasDeepDiveContent
                  ? "A comprehensive, documentation-style exploration of your workspace topic."
                  : "Generate a long-form explanation expanding on your Study Summary."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!hasDeepDiveContent && !isDeepDiveRunning && (
                <Button
                  size="sm"
                  onClick={() => onGenerate("deepdive")}
                  className="gap-1.5 text-xs"
                >
                  Generate
                </Button>
              )}
              {(hasDeepDiveContent || isDeepDiveRunning) && (
                <Link href={`/workspace/${workspaceId}/deepdive`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                  >
                    {hasDeepDiveContent ? "Read" : "View progress"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
