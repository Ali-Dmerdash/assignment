import { createFileRoute, redirect } from "@tanstack/react-router"
import { authStore, homePathFor } from "@/store/auth"

// Landing route: bounce to the right place based on session + role.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const { token, user } = authStore.state
    if (!token || !user) {
      throw redirect({ to: "/login" })
    }
    throw redirect({ to: homePathFor(user.role) })
  },
})
