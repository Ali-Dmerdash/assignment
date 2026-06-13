import { useStore } from "@tanstack/react-store"
import { Link } from "@tanstack/react-router"
import { IconBell } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  clearNotifications,
  markNotificationsRead,
  notificationsStore,
} from "@/store/notifications"

/** Employer-only: bell with an unread badge + a panel of recent applications. */
export function NotificationBell() {
  const { items, unread } = useStore(notificationsStore, (s) => s)

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) markNotificationsRead()
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />
        }
      >
        <IconBell className="size-5" />
        {unread > 0 && (
          <Badge
            className="absolute -top-1 -right-1 size-5 justify-center rounded-full p-0 text-[10px] tabular-nums"
            variant="destructive"
          >
            {unread > 9 ? "9+" : unread}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-medium">Notifications</span>
          {items.length > 0 && (
            <button
              className="text-muted-foreground hover:text-foreground text-xs"
              onClick={() => clearNotifications()}
            >
              Clear
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            No notifications yet.
          </p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              render={
                <Link
                  to="/dashboard/jobs/$jobId/applicants"
                  params={{ jobId: n.jobId }}
                />
              }
              className="flex-col items-start gap-0.5"
            >
              <span className="text-sm font-medium">{n.applicantName}</span>
              <span className="text-muted-foreground text-xs">
                applied to {n.jobTitle}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
