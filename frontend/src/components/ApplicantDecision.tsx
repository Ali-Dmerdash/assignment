import { useMutation, useQueryClient } from "@tanstack/react-query"
import { IconCheck, IconX } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { decideApplication, jobKeys } from "@/lib/queries"
import type { Application, ApplicationStatus } from "@/lib/types"
import type { ApiError } from "@/lib/api"

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending: "bg-muted text-muted-foreground border-transparent",
  accepted:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected:
    "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
}

/** Status badge + Accept/Reject controls for one application (employer side). */
export function ApplicantDecision({
  jobId,
  application,
}: {
  jobId: string
  application: Application
}) {
  const queryClient = useQueryClient()
  const status = application.status

  const mutation = useMutation({
    mutationFn: (next: "accepted" | "rejected") =>
      decideApplication(jobId, application._id, next),
    onSuccess: (_res, next) => {
      toast.success(next === "accepted" ? "Applicant accepted" : "Applicant rejected")
      queryClient.invalidateQueries({ queryKey: jobKeys.applicants(jobId) })
    },
    onError: (err: ApiError) => toast.error(err.message),
  })

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`capitalize ${STATUS_STYLE[status]}`}>
        {status}
      </Badge>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={status === "accepted" || mutation.isPending}
          onClick={() => mutation.mutate("accepted")}
        >
          <IconCheck className="size-4" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={status === "rejected" || mutation.isPending}
          onClick={() => mutation.mutate("rejected")}
        >
          <IconX className="size-4" />
          Reject
        </Button>
      </div>
    </div>
  )
}
