import { useEffect } from "react"
import { useStore } from "@tanstack/react-store"
import { toast } from "sonner"
import { authStore } from "@/store/auth"
import { connectSocket, disconnectSocket } from "@/lib/socket"
import { pushNotification } from "@/store/notifications"
import type {
  ApplicationDecisionPayload,
  NewApplicationPayload,
} from "@/lib/types"

export function SocketManager() {
  const { token, user } = useStore(authStore, (s) => s)

  useEffect(() => {
    if (!token || !user) {
      disconnectSocket()
      return
    }

    const socket = connectSocket(token)

    const onNewApplication = (payload: NewApplicationPayload) => {
      pushNotification({
        kind: "new_application",
        jobId: payload.jobId,
        jobTitle: payload.jobTitle,
        applicantName: payload.applicantName,
      })
      toast.success("New application", {
        description: `${payload.applicantName} applied to "${payload.jobTitle}"`,
      })
    }

    const onDecision = (payload: ApplicationDecisionPayload) => {
      pushNotification({
        kind: "application_decision",
        jobId: payload.jobId,
        jobTitle: payload.jobTitle,
        status: payload.status,
      })
      const accepted = payload.status === "accepted"
      const notify = accepted ? toast.success : toast.info
      notify(accepted ? "Application accepted" : "Application rejected", {
        description: `Your application for "${payload.jobTitle}" was ${payload.status}.`,
      })
    }

    socket.on("new_application", onNewApplication)
    socket.on("application_decision", onDecision)
    return () => {
      socket.off("new_application", onNewApplication)
      socket.off("application_decision", onDecision)
    }
  }, [token, user?.id])

  return null
}
