import { Badge } from "@/components/ui/badge"
import type { JobStatus } from "@/lib/types"

const STYLES: Record<JobStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  published: {
    label: "Published",
    className:
      "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  closed: {
    label: "Closed",
    className: "bg-muted text-muted-foreground border-transparent line-through",
  },
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { label, className } = STYLES[status]
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}
