import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
