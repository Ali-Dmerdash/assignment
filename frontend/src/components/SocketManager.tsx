import { useEffect } from "react"
import { useStore } from "@tanstack/react-store"
import { toast } from "sonner"
import { authStore } from "@/store/auth"
import { connectSocket, disconnectSocket } from "@/lib/socket"
import { pushNotification } from "@/store/notifications"
import type { NewApplicationPayload } from "@/lib/types"

/**
 * Headless component: keeps a single authenticated socket alive for the logged-in
 * employer and turns `new_application` events into a toast + a notifications-store
 * entry (which drives the navbar badge). Applicants get no socket — only
 * employers receive room events.
 */
export function SocketManager() {
  const { token, user } = useStore(authStore, (s) => s)

  useEffect(() => {
    if (!token || user?.role !== "employer") {
      disconnectSocket()
      return
    }

    const socket = connectSocket(token)

    const onNewApplication = (payload: NewApplicationPayload) => {
      pushNotification(payload, Date.now())
      toast.success("New application", {
        description: `${payload.applicantName} applied to "${payload.jobTitle}"`,
      })
    }

    socket.on("new_application", onNewApplication)
    return () => {
      socket.off("new_application", onNewApplication)
    }
  }, [token, user?.role])

  return null
}
