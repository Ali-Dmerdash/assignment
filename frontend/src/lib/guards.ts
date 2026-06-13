import { redirect } from "@tanstack/react-router"
import type { AuthUser, UserRole } from "@/lib/types"
import { authStore, homePathFor } from "@/store/auth"

export function requireAuth(): AuthUser {
  const { token, user } = authStore.state
  if (!token || !user) {
    throw redirect({ to: "/login" })
  }
  return user
}

export function requireRole(role: UserRole): AuthUser {
  const user = requireAuth()
  if (user.role !== role) {
    throw redirect({ to: homePathFor(user.role) })
  }
  return user
}
