import { useEffect, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { IconMapPin, IconSearch } from "@tabler/icons-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Paginator } from "@/components/Paginator"
import { publishedJobsQuery } from "@/lib/queries"
import { requireRole } from "@/lib/guards"
import { formatDate } from "@/lib/format"

const LIMIT = 10

interface JobSearch {
  page: number
  location: string
  keyword: string
}

export const Route = createFileRoute("/jobs/")({
  beforeLoad: () => requireRole("applicant"),
  validateSearch: (search: Record<string, unknown>): JobSearch => ({
    page: Math.max(1, Number(search.page) || 1),
    location: typeof search.location === "string" ? search.location : "",
    keyword: typeof search.keyword === "string" ? search.keyword : "",
  }),
  component: BrowseJobs,
})

function BrowseJobs() {
  const { page, location, keyword } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // Local input state, pushed to the URL (and thus the query) after a debounce.
  const [locationInput, setLocationInput] = useState(location)
  const [keywordInput, setKeywordInput] = useState(keyword)

  useEffect(() => setLocationInput(location), [location])
  useEffect(() => setKeywordInput(keyword), [keyword])

  useEffect(() => {
    const t = setTimeout(() => {
      if (locationInput === location && keywordInput === keyword) return
      navigate({
        search: { page: 1, location: locationInput, keyword: keywordInput },
      })
    }, 350)
    return () => clearTimeout(t)
  }, [locationInput, keywordInput, location, keyword, navigate])

  const query = useQuery(
    publishedJobsQuery({ page, limit: LIMIT, location, keyword }),
  )

  const jobs = query.data?.data ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Browse jobs</h1>
        <p className="text-muted-foreground">
          {query.isSuccess
            ? `${total} published ${total === 1 ? "job" : "jobs"}`
            : "Find your next role."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="keyword">Keyword</Label>
          <div className="relative">
            <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              id="keyword"
              className="pl-8"
              placeholder="Title or description…"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <div className="relative">
            <IconMapPin className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              id="location"
              className="pl-8"
              placeholder="e.g. Montreal"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
            />
          </div>
        </div>
      </div>

      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load jobs</AlertTitle>
          <AlertDescription>{(query.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            No jobs match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <Link
              key={job._id}
              to="/jobs/$jobId"
              params={{ jobId: job._id }}
              className="block"
            >
              <Card className="transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      <p className="text-muted-foreground text-sm">
                        {job.company}
                      </p>
                    </div>
                    {job.salary && <Badge variant="secondary">{job.salary}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {job.location && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <IconMapPin className="size-4" />
                      {job.location}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    Posted {formatDate(job.datePosted ?? job.createdAt)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Paginator
        page={page}
        total={total}
        limit={LIMIT}
        onPageChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })}
      />
    </div>
  )
}
