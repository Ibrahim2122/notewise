"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Link as LinkIcon,
  FileText,
  Mic,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  uploadSource,
  attachText,
  attachLink,
  createSource,
  getUploadUrl,
  uploadFileToBlob,
  completeUpload,
  pollSourceStatus,
  type Source,
  type SourceStatus,
} from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadState {
  phase: "idle" | "uploading" | "processing" | "done" | "failed";
  fileName?: string;
  progress: number;
  error?: string;
}

interface SourceUploadPanelProps {
  workspaceId: string;
  onSourceAdded: (source: Source) => void;
}

// ─── Polling helper ──────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function pollUntilTerminal(
  sourceId: string,
  onStatus: (s: SourceStatus) => void,
): Promise<SourceStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await pollSourceStatus(sourceId);
    onStatus(result.status);
    if (result.status === "done" || result.status === "failed") {
      return result.status;
    }
  }
  return "failed";
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all duration-200"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ─── Upload status indicator ──────────────────────────────────────────────────

function UploadStatus({ state }: { state: UploadState }) {
  if (state.phase === "idle") return null;

  let icon: React.ReactNode;
  let text: string;
  let color: string;

  if (state.phase === "uploading") {
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    text = `Uploading ${state.fileName ?? "file"}… ${state.progress}%`;
    color = "text-muted-foreground";
  } else if (state.phase === "processing") {
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    text = "Processing… this may take a moment";
    color = "text-muted-foreground";
  } else if (state.phase === "done") {
    icon = <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    text = `${state.fileName ?? "Source"} ready`;
    color = "text-green-600 dark:text-green-400";
  } else {
    icon = <XCircle className="h-3.5 w-3.5 text-destructive" />;
    text = state.error ?? "Upload failed";
    color = "text-destructive";
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className={`flex items-center gap-2 text-xs ${color}`}>
        {icon}
        <span>{text}</span>
      </div>
      {state.phase === "uploading" && <ProgressBar percent={state.progress} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SourceUploadPanel({
  workspaceId,
  onSourceAdded,
}: SourceUploadPanelProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [pdfState, setPdfState] = useState<UploadState>({
    phase: "idle",
    progress: 0,
  });
  const [audioState, setAudioState] = useState<UploadState>({
    phase: "idle",
    progress: 0,
  });
  const [textContent, setTextContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textAdding, setTextAdding] = useState(false);
  const [linkAdding, setLinkAdding] = useState(false);

  // ── Binary upload ─────────────────────────────────────────────────────────

  async function handleBinaryFile(
    file: File,
    sourceType: "pdf" | "audio",
    setState: React.Dispatch<React.SetStateAction<UploadState>>,
  ) {
    setState({ phase: "uploading", fileName: file.name, progress: 0 });
    try {
      // Step 1: create source record
      const source = await createSource(
        workspaceId,
        file.name,
        sourceType,
        file.type || "application/octet-stream",
        file.name,
      );

      // Step 2: get SAS upload URL
      const { upload_url, blob_path } = await getUploadUrl(source.id);

      // Step 3: upload directly to blob with progress
      await uploadFileToBlob(upload_url, file, (pct) => {
        setState((prev) => ({ ...prev, progress: pct }));
      });

      // Step 4: finalize
      const finalised = await completeUpload(
        source.id,
        blob_path,
        file.type || "application/octet-stream",
        file.name,
      );
      onSourceAdded(finalised);

      // Step 5: poll until processing completes
      setState({ phase: "processing", fileName: file.name, progress: 100 });
      const terminal = await pollUntilTerminal(finalised.id, () => {});

      if (terminal === "done") {
        setState({ phase: "done", fileName: file.name, progress: 100 });
        onSourceAdded({ ...finalised, status: "done" });
      } else {
        setState({
          phase: "failed",
          fileName: file.name,
          progress: 100,
          error: "Processing failed — check the source status panel",
        });
      }
    } catch (err) {
      setState({
        phase: "failed",
        fileName: file.name,
        progress: 0,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    handleBinaryFile(file, "pdf", setPdfState);
  }

  function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    handleBinaryFile(file, "audio", setAudioState);
  }

  // ── Text ──────────────────────────────────────────────────────────────────

  async function handleAddText() {
    if (!textContent.trim()) return;
    setTextAdding(true);
    try {
      // Create the source record first, then attach text
      const source = await createSource(
        workspaceId,
        textTitle.trim() || "Text note",
        "text",
        "text/plain",
        "text-note.txt",
      );
      const finalised = await attachText(source.id, textContent.trim());
      onSourceAdded(finalised);
      setTextContent("");
      setTextTitle("");
    } catch (err) {
      console.error("Failed to add text source", err);
    } finally {
      setTextAdding(false);
    }
  }

  // ── Link ──────────────────────────────────────────────────────────────────

  async function handleAddLink() {
    if (!linkUrl.trim()) return;
    setLinkAdding(true);
    try {
      // Create the source record first, then attach the URL
      const source = await createSource(
        workspaceId,
        linkUrl.trim(),
        "url",
        "text/html",
        linkUrl.trim(),
      );
      const finalised = await attachLink(source.id, linkUrl.trim());
      onSourceAdded(finalised);
      setLinkUrl("");
    } catch (err) {
      console.error("Failed to add link source", err);
    } finally {
      setLinkAdding(false);
    }
  }

  const pdfBusy =
    pdfState.phase === "uploading" || pdfState.phase === "processing";
  const audioBusy =
    audioState.phase === "uploading" || audioState.phase === "processing";

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add Source</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="file" className="gap-1 text-xs">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">File</span>
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Text</span>
            </TabsTrigger>
            <TabsTrigger value="link" className="gap-1 text-xs">
              <LinkIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Link</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1 text-xs">
              <Mic className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Audio</span>
            </TabsTrigger>
          </TabsList>

          {/* PDF */}
          <TabsContent value="file" className="mt-4">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload a PDF document
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => pdfInputRef.current?.click()}
                disabled={pdfBusy}
              >
                {pdfBusy ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Select PDF"
                )}
              </Button>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handlePdfChange}
              />
            </div>
            <UploadStatus state={pdfState} />
          </TabsContent>

          {/* Text */}
          <TabsContent value="text" className="mt-4">
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Title (optional)"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
              <textarea
                className="min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Paste your notes or text here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleAddText}
                disabled={!textContent.trim() || textAdding}
                className="self-end gap-1"
              >
                {textAdding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add text
              </Button>
            </div>
          </TabsContent>

          {/* Link */}
          <TabsContent value="link" className="mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/article"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
              />
              <Button
                size="sm"
                onClick={handleAddLink}
                disabled={!linkUrl.trim() || linkAdding}
                className="shrink-0 gap-1"
              >
                {linkAdding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add
              </Button>
            </div>
          </TabsContent>

          {/* Audio */}
          <TabsContent value="audio" className="mt-4">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
              <Mic className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload an audio recording
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => audioInputRef.current?.click()}
                disabled={audioBusy}
              >
                {audioBusy ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Select audio file"
                )}
              </Button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg"
                className="hidden"
                onChange={handleAudioChange}
              />
            </div>
            <UploadStatus state={audioState} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
