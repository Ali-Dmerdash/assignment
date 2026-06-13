import { Link, useNavigate } from "@tanstack/react-router"
import { useStore } from "@tanstack/react-store"
import { IconBriefcase, IconLogout } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { NotificationBell } from "@/components/NotificationBell"
import { authStore, clearSession, homePathFor } from "@/store/auth"
import { clearNotifications } from "@/store/notifications"
import { disconnectSocket } from "@/lib/socket"

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function Navbar() {
  const { user } = useStore(authStore, (s) => s)
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    // Stateless JWT: logout is purely client-side — drop the token + local state.
    disconnectSocket()
    clearSession()
    clearNotifications()
    navigate({ to: "/login" })
  }

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          to={homePathFor(user.role)}
          className="flex items-center gap-2 font-semibold"
        >
          <IconBriefcase className="size-5" />
          <span>JobBoard</span>
        </Link>

        <nav className="flex items-center gap-1.5">
          {user.role === "applicant" ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={
                <Link
                  to="/jobs"
                  search={{ page: 1, location: "", keyword: "" }}
                />
              }
            >
              Browse jobs
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link to="/dashboard" />}
              >
                My jobs
              </Button>
              <NotificationBell />
            </>
          )}

          <div className="ml-1 flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-sm leading-tight sm:block">
              <div className="font-medium">{user.name}</div>
              <div className="text-muted-foreground text-xs capitalize">
                {user.role}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={handleLogout}
          >
            <IconLogout className="size-5" />
          </Button>
        </nav>
      </div>
    </header>
  )
}
