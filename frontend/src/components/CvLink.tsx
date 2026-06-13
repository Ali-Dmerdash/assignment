import { useState } from "react"
import { IconFileText, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchCv } from "@/lib/api"
import { formatBytes } from "@/lib/format"
import type { Application } from "@/lib/types"
import type { ApiError } from "@/lib/api"

const CV_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
}

/**
 * Renders the CV as a button that fetches the file (with the auth header) and
 * opens it in a new tab — PDFs view inline, other types download. Falls back to
 * a forced download if the popup is blocked.
 */
export function CvLink({
  jobId,
  application,
}: {
  jobId: string
  application: Application
}) {
  const [loading, setLoading] = useState(false)
  const { originalName, mimeType, size } = application.cv

  const open = async () => {
    setLoading(true)
    try {
      const blob = await fetchCv(jobId, application._id)
      const url = URL.createObjectURL(blob)
      const win = window.open(url, "_blank", "noopener")
      if (!win) {
        // popup blocked — fall back to a download
        const a = document.createElement("a")
        a.href = url
        a.download = originalName
        a.click()
      }
      // give the new tab time to load before releasing the blob
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.error((err as ApiError).message || "Could not open the CV")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto gap-1.5 px-1.5 py-1"
      onClick={open}
      disabled={loading}
    >
      {loading ? (
        <IconLoader2 className="size-4 animate-spin" />
      ) : (
        <IconFileText className="text-muted-foreground size-4" />
      )}
      <span className="max-w-40 truncate underline-offset-2 hover:underline">
        {originalName}
      </span>
      <Badge variant="secondary" className="text-[10px]">
        {CV_LABEL[mimeType] ?? "FILE"}
      </Badge>
      <span className="text-muted-foreground text-xs">{formatBytes(size)}</span>
    </Button>
  )
}
