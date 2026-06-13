export type UserRole = "employer" | "applicant"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export type JobStatus = "draft" | "published" | "closed"

export interface Job {
  _id: string
  title: string
  company: string
  description: string
  location?: string
  salary?: string
  status: JobStatus
  employer: string
  datePosted?: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedJobs {
  data: Job[]
  total: number
  page: number
  limit: number
}

export interface CvFile {
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
}

export interface Application {
  _id: string
  job: string
  applicant: { _id: string; name: string; email: string }
  name: string
  email: string
  coverNote?: string
  cv: CvFile
  createdAt: string
  updatedAt: string
}

export interface ApplicantList {
  data: Application[]
  total: number
}

export interface NewApplicationPayload {
  applicationId: string
  jobId: string
  jobTitle: string
  applicantName: string
}
