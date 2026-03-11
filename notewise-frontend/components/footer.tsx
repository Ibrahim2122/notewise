import { BookOpen } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row lg:px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span>NoteWise</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for students who learn smarter.
        </p>
      </div>
    </footer>
  )
}
