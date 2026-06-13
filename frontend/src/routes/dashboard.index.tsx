import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconDotsVertical, IconPlus } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { JobStatusBadge } from "@/components/JobStatusBadge"
import { closeJob, jobKeys, myJobsQuery, updateJob } from "@/lib/queries"
import { requireRole } from "@/lib/guards"
import { formatDate } from "@/lib/format"
import type { Job } from "@/lib/types"
import type { ApiError } from "@/lib/api"

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: () => requireRole("employer"),
  component: Dashboard,
})

function Dashboard() {
  const query = useQuery(myJobsQuery())
  const jobs = query.data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My jobs</h1>
          <p className="text-muted-foreground">
            Manage your postings and review applicants.
          </p>
        </div>
        <Button nativeButton={false} render={<Link to="/dashboard/jobs/new" />}>
          <IconPlus className="size-4" />
          New job
        </Button>
      </div>

      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load your jobs</AlertTitle>
          <AlertDescription>{(query.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {query.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">
              You haven&apos;t posted any jobs yet.
            </p>
            <Button nativeButton={false} render={<Link to="/dashboard/jobs/new" />}>
              <IconPlus className="size-4" />
              Post your first job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job._id}>
                  <TableCell>
                    <div className="font-medium">{job.title}</div>
                    <div className="text-muted-foreground text-sm">
                      {job.company}
                    </div>
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {job.status === "published"
                      ? formatDate(job.datePosted ?? job.createdAt)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <RowActions job={job} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function RowActions({ job }: { job: Job }) {
  const queryClient = useQueryClient()
  const [confirmClose, setConfirmClose] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: jobKeys.mine() })

  const publish = useMutation({
    mutationFn: () => updateJob(job._id, { status: "published" }),
    onSuccess: () => {
      toast.success("Job published")
      invalidate()
    },
    onError: (err: ApiError) => toast.error(err.message),
  })

  const close = useMutation({
    mutationFn: () => closeJob(job._id),
    onSuccess: () => {
      toast.success("Job closed")
      setConfirmClose(false)
      invalidate()
    },
    onError: (err: ApiError) => toast.error(err.message),
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Job actions" />
          }
        >
          <IconDotsVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <Link
                to="/dashboard/jobs/$jobId/applicants"
                params={{ jobId: job._id }}
              />
            }
          >
            View applicants
          </DropdownMenuItem>
          {job.status !== "closed" && (
            <DropdownMenuItem
              render={
                <Link
                  to="/dashboard/jobs/$jobId/edit"
                  params={{ jobId: job._id }}
                />
              }
            >
              Edit
            </DropdownMenuItem>
          )}
          {job.status === "draft" && (
            <DropdownMenuItem
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
            >
              Publish
            </DropdownMenuItem>
          )}
          {job.status !== "closed" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmClose(true)}
              >
                Close
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close “{job.title}”?</DialogTitle>
            <DialogDescription>
              No new applications will be accepted. A closed job cannot be
              deleted or reopened from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => close.mutate()}
              disabled={close.isPending}
            >
              {close.isPending ? "Closing…" : "Close job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
