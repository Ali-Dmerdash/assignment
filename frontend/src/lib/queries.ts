import { queryOptions } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type {
  ApplicantList,
  Application,
  AuthResponse,
  Job,
  PaginatedJobs,
  UserRole,
} from "@/lib/types"

// ---- Query keys -----------------------------------------------------------

export const jobKeys = {
  all: ["jobs"] as const,
  published: (params: JobListParams) => ["jobs", "published", params] as const,
  mine: () => ["jobs", "mine"] as const,
  detail: (jobId: string) => ["jobs", "detail", jobId] as const,
  applicants: (jobId: string) => ["jobs", jobId, "applicants"] as const,
}

// ---- Applicant: browse published jobs -------------------------------------

export interface JobListParams {
  page: number
  limit: number
  location: string
  keyword: string
}

export function publishedJobsQuery(params: JobListParams) {
  return queryOptions({
    queryKey: jobKeys.published(params),
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      })
      if (params.location) qs.set("location", params.location)
      if (params.keyword) qs.set("keyword", params.keyword)
      return apiFetch<PaginatedJobs>(`/api/jobs?${qs.toString()}`, { signal })
    },
    // Keep the previous page visible while the next one loads.
    placeholderData: (prev) => prev,
  })
}

// ---- Employer: own jobs ----------------------------------------------------

export function jobDetailQuery(jobId: string) {
  return queryOptions({
    queryKey: jobKeys.detail(jobId),
    // `applied` is present for applicants: whether they've already applied.
    queryFn: ({ signal }) =>
      apiFetch<{ job: Job; applied?: boolean }>(`/api/jobs/${jobId}`, { signal }),
  })
}

export function myJobsQuery() {
  return queryOptions({
    queryKey: jobKeys.mine(),
    queryFn: ({ signal }) =>
      apiFetch<{ data: Job[]; total: number }>("/api/jobs/mine", { signal }),
  })
}

export function jobApplicantsQuery(jobId: string) {
  return queryOptions({
    queryKey: jobKeys.applicants(jobId),
    queryFn: ({ signal }) =>
      apiFetch<ApplicantList>(`/api/jobs/${jobId}/applicants`, { signal }),
  })
}

// ---- Mutations (raw fns; wrapped in useMutation at call sites) -------------

export interface JobInput {
  title: string
  company: string
  description: string
  location?: string
  salary?: string
  status?: "draft" | "published"
}

export function createJob(input: JobInput) {
  return apiFetch<{ job: Job }>("/api/jobs", { method: "POST", json: input })
}

export function updateJob(id: string, input: Partial<JobInput>) {
  return apiFetch<{ job: Job }>(`/api/jobs/${id}`, {
    method: "PUT",
    json: input,
  })
}

export function closeJob(id: string) {
  return apiFetch<{ job: Job }>(`/api/jobs/${id}/close`, { method: "PATCH" })
}

export function applyToJob(jobId: string, body: FormData) {
  return apiFetch<{ application: Application }>(`/api/jobs/${jobId}/apply`, {
    method: "POST",
    body,
  })
}

// ---- Auth ------------------------------------------------------------------

export function login(body: { email: string; password: string }) {
  return apiFetch<AuthResponse>("/api/auth/login", { method: "POST", json: body })
}

export function register(body: {
  name: string
  email: string
  password: string
  role: UserRole
}) {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    json: body,
  })
}
