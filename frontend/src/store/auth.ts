import { Store } from "@tanstack/store"
import type { AuthResponse, AuthUser, UserRole } from "@/lib/types"
import { deleteCookie, getCookie, setCookie } from "@/lib/cookies"

const COOKIE_NAME = "jobboard_session"
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

export interface AuthState {
  token: string | null
  user: AuthUser | null
}

const EMPTY: AuthState = { token: null, user: null }

function loadSession(): AuthState {
  const raw = getCookie(COOKIE_NAME)
  if (!raw) return EMPTY
  try {
    const parsed = JSON.parse(raw) as AuthResponse
    if (parsed?.token && parsed?.user) {
      return { token: parsed.token, user: parsed.user }
    }
  } catch {
    deleteCookie(COOKIE_NAME)
  }
  return EMPTY
}

export const authStore = new Store<AuthState>(loadSession())

export function setSession(session: AuthResponse) {
  setCookie(COOKIE_NAME, JSON.stringify(session), COOKIE_MAX_AGE)
  authStore.setState(() => ({ token: session.token, user: session.user }))
}

export function clearSession() {
  deleteCookie(COOKIE_NAME)
  authStore.setState(() => EMPTY)
}

export function getToken(): string | null {
  return authStore.state.token
}

export function homePathFor(role: UserRole): string {
  return role === "employer" ? "/dashboard" : "/jobs"
}
