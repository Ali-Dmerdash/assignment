import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { JobForm } from "@/components/JobForm"
import { createJob, jobKeys, type JobInput } from "@/lib/queries"
import { requireRole } from "@/lib/guards"
import type { ApiError } from "@/lib/api"

export const Route = createFileRoute("/dashboard/jobs/new")({
  beforeLoad: () => requireRole("employer"),
  component: NewJob,
})

function NewJob() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (input: JobInput) => createJob(input),
    onSuccess: (res) => {
      toast.success(
        res.job.status === "published"
          ? "Job created and published"
          : "Draft saved",
      )
      queryClient.invalidateQueries({ queryKey: jobKeys.mine() })
      navigate({ to: "/dashboard" })
    },
    onError: (err: ApiError) => toast.error(err.message),
  })

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
          <CardTitle>Post a new job</CardTitle>
          <CardDescription>
            Save it as a draft, or publish it straight away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobForm
            submitLabel="Create job"
            pending={mutation.isPending}
            onSubmit={(values) => mutation.mutate(values)}
            onCancel={() => navigate({ to: "/dashboard" })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
