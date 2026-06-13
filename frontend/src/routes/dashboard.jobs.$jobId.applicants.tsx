import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { IconArrowLeft } from "@tabler/icons-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CvLink } from "@/components/CvLink"
import { jobApplicantsQuery, jobDetailQuery } from "@/lib/queries"
import { requireRole } from "@/lib/guards"
import { formatDate } from "@/lib/format"

export const Route = createFileRoute("/dashboard/jobs/$jobId/applicants")({
  beforeLoad: () => requireRole("employer"),
  component: Applicants,
})

function Applicants() {
  const { jobId } = Route.useParams()
  const jobQuery = useQuery(jobDetailQuery(jobId))
  const query = useQuery(jobApplicantsQuery(jobId))
  const applications = query.data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
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

      <div>
        <h1 className="text-2xl font-semibold">Applicants</h1>
        <p className="text-muted-foreground">
          {jobQuery.data?.job.title ?? "Job"} ·{" "}
          {query.isSuccess
            ? `${query.data.total} ${query.data.total === 1 ? "application" : "applications"}`
            : "loading…"}
        </p>
      </div>

      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load applicants</AlertTitle>
          <AlertDescription>{(query.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {query.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            No applications yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Cover note</TableHead>
                <TableHead>CV</TableHead>
                <TableHead>Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app._id}>
                  <TableCell>
                    <div className="font-medium">{app.applicant.name}</div>
                    <a
                      href={`mailto:${app.applicant.email}`}
                      className="text-muted-foreground text-sm hover:underline"
                    >
                      {app.applicant.email}
                    </a>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {app.coverNote ? (
                      <p className="text-sm whitespace-pre-wrap">
                        {app.coverNote}
                      </p>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <CvLink jobId={jobId} application={app} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(app.createdAt)}
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
