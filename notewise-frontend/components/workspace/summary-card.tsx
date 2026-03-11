"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface SummaryCardProps {
  summary: string | null;
  workspaceId: string;
  hasSources: boolean;
}

export function SummaryCard({ summary, hasSources }: SummaryCardProps) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Study Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summary ? (
          <p
            className="text-sm leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: summary }}
          />
        ) : (
          <div className="flex flex-col items-center rounded-lg bg-muted/30 px-4 py-8 text-center">
            <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {hasSources
                ? "Summary will appear here once your sources finish processing."
                : "Add sources to generate a summary."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
