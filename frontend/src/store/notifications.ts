import { Store } from "@tanstack/store"

// Real-time notifications shown in the navbar bell. A discriminated union so each
// kind can render its own message + deep link:
//  - employer receives "new_application" when someone applies to their job
//  - applicant receives "application_decision" when an employer accepts/rejects
export type NotificationData =
  | {
      kind: "new_application"
      jobId: string
      jobTitle: string
      applicantName: string
    }
  | {
      kind: "application_decision"
      jobId: string
      jobTitle: string
      status: "accepted" | "rejected"
    }

export type NotificationItem = NotificationData & {
  id: string
  receivedAt: number
}

export interface NotificationState {
  items: NotificationItem[]
  /** Count not yet seen by the user (drives the badge). */
  unread: number
}

export const notificationsStore = new Store<NotificationState>({
  items: [],
  unread: 0,
})

let seq = 0

export function pushNotification(data: NotificationData) {
  const item = { ...data, id: `n${++seq}`, receivedAt: Date.now() } as NotificationItem
  notificationsStore.setState((s) => ({
    items: [item, ...s.items].slice(0, 50),
    unread: s.unread + 1,
  }))
}

export function markNotificationsRead() {
  notificationsStore.setState((s) => (s.unread === 0 ? s : { ...s, unread: 0 }))
}

export function clearNotifications() {
  notificationsStore.setState(() => ({ items: [], unread: 0 }))
}
