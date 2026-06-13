import { clearSession, getToken } from "@/store/auth"

// Required — no in-code default. Fail loudly if it's missing rather than silently
// pointing at some assumed URL. Copy frontend/.env.example to frontend/.env.
const apiUrl = import.meta.env.VITE_API_URL
if (!apiUrl) {
  throw new Error(
    "VITE_API_URL is not set — copy frontend/.env.example to frontend/.env",
  )
}

export const API_URL = apiUrl.replace(/\/$/, "")

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

interface RequestOptions {
  method?: string
  json?: unknown
  body?: BodyInit
  signal?: AbortSignal
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(options.json)
  } else {
    body = options.body
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
  })

  if (res.status === 401 && token) {
    clearSession()
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ?? `Request failed (${res.status})`
    throw new ApiError(res.status, message)
  }

  return data as T
}

/**
 * Fetch a CV as a Blob (the endpoint streams a file, not JSON). Sends the Bearer
 * token like apiFetch — a plain <a href> can't, since auth is a header.
 */
export async function fetchCv(
  jobId: string,
  applicationId: string,
): Promise<Blob> {
  const token = getToken()
  const res = await fetch(
    `${API_URL}/api/jobs/${jobId}/applicants/${applicationId}/cv`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  )

  if (res.status === 401 && token) clearSession()

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = String(data.error)
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, message)
  }

  return res.blob()
}
