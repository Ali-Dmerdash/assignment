import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconArrowLeft } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { JobForm } from "@/components/JobForm"
import {
  jobDetailQuery,
  jobKeys,
  updateJob,
  type JobInput,
} from "@/lib/queries"
import { requireRole } from "@/lib/guards"
import type { ApiError } from "@/lib/api"

export const Route = createFileRoute("/dashboard/jobs/$jobId/edit")({
  beforeLoad: () => requireRole("employer"),
  component: EditJob,
})

function EditJob() {
  const { jobId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery(jobDetailQuery(jobId))

  const mutation = useMutation({
    mutationFn: (input: JobInput) => updateJob(jobId, input),
    onSuccess: () => {
      toast.success("Job updated")
      queryClient.invalidateQueries({ queryKey: jobKeys.mine() })
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) })
      navigate({ to: "/dashboard" })
    },
    onError: (err: ApiError) => toast.error(err.message),
  })

  const job = query.data?.job
  // A closed job can no longer be edited back to draft/published here.
  const isClosed = job?.status === "closed"

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        nativeButton={false}
        render={<Link to="/dashboard" />}
      >
        <IconArrowLeft className="size-4" />
        Back to dashboard
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Edit job</CardTitle>
          <CardDescription>Update the details or publish a draft.</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : query.isError || !job ? (
            <Alert variant="destructive">
              <AlertTitle>Job unavailable</AlertTitle>
              <AlertDescription>
                {(query.error as Error)?.message ??
                  "This job could not be loaded."}
              </AlertDescription>
            </Alert>
          ) : isClosed ? (
            <Alert>
              <AlertTitle>This job is closed</AlertTitle>
              <AlertDescription>
                Closed jobs are read-only and cannot be edited.
              </AlertDescription>
            </Alert>
          ) : (
            <JobForm
              initial={{
                title: job.title,
                company: job.company,
                description: job.description,
                location: job.location ?? "",
                salary: job.salary ?? "",
                status: job.status as "draft" | "published",
              }}
              submitLabel="Save changes"
              pending={mutation.isPending}
              onSubmit={(values) => mutation.mutate(values)}
              onCancel={() => navigate({ to: "/dashboard" })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
