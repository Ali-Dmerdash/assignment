import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconMapPin,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { ApplyDialog } from "@/components/ApplyDialog"
import { jobDetailQuery } from "@/lib/queries"
import { requireRole } from "@/lib/guards"
import { formatDate } from "@/lib/format"
import type { Job } from "@/lib/types"

export const Route = createFileRoute("/jobs/$jobId")({
  beforeLoad: () => requireRole("applicant"),
  component: JobDetail,
})

function JobDetail() {
  const { jobId } = Route.useParams()
  const query = useQuery(jobDetailQuery(jobId))
  // `applied` is known at load from the server; `justApplied` flips it instantly
  // after a successful (or 409) apply without waiting for a refetch.
  const [justApplied, setJustApplied] = useState(false)
  const applied = (query.data?.applied ?? false) || justApplied

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        nativeButton={false}
        render={
          <Link to="/jobs" search={{ page: 1, location: "", keyword: "" }} />
        }
      >
        <IconArrowLeft className="size-4" />
        Back to jobs
      </Button>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Job unavailable</AlertTitle>
          <AlertDescription>
            {(query.error as Error).message}. It may have been closed or removed.
          </AlertDescription>
        </Alert>
      ) : query.data ? (
        <JobBody
          job={query.data.job}
          applied={applied}
          onApplied={() => setJustApplied(true)}
        />
      ) : null}
    </div>
  )
}

function JobBody({
  job,
  applied,
  onApplied,
}: {
  job: Job
  applied: boolean
  onApplied: () => void
}) {
  const isOpen = job.status === "published"

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">{job.title}</CardTitle>
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
              <IconBuilding className="size-4" />
              {job.company}
            </p>
          </div>
          {job.salary && (
            <Badge variant="secondary" className="text-sm">
              {job.salary}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {job.location && (
            <span className="flex items-center gap-1">
              <IconMapPin className="size-4" />
              {job.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <IconCalendar className="size-4" />
            Posted {formatDate(job.datePosted ?? job.createdAt)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <Separator />
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {job.description}
        </div>
        <Separator />

        {!isOpen ? (
          <Alert>
            <AlertTitle>Applications closed</AlertTitle>
            <AlertDescription>
              This job is no longer accepting applications.
            </AlertDescription>
          </Alert>
        ) : applied ? (
          <div className="flex flex-col items-start gap-2">
            <Button size="lg" disabled>
              <IconCheck className="size-4" />
              Already applied
            </Button>
            <p className="text-muted-foreground text-sm">
              You have already applied to this job.
            </p>
          </div>
        ) : (
          <ApplyDialog
            jobId={job._id}
            jobTitle={job.title}
            onApplied={onApplied}
          />
        )}
      </CardContent>
    </Card>
  )
}
