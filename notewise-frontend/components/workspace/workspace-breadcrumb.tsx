import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface WorkspaceBreadcrumbProps {
  name: string
}

export function WorkspaceBreadcrumb({ name }: WorkspaceBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/dashboard" className="transition-colors hover:text-foreground">
        Workspaces
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="font-medium text-foreground">{name}</span>
    </nav>
  )
}
