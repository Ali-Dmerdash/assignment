import { Store } from "@tanstack/store"
import type { NewApplicationPayload } from "@/lib/types"

export interface NotificationItem extends NewApplicationPayload {
  id: string
  receivedAt: number
}

export interface NotificationState {
  items: NotificationItem[]
  unread: number
}

export const notificationsStore = new Store<NotificationState>({
  items: [],
  unread: 0,
})

export function pushNotification(
  payload: NewApplicationPayload,
  receivedAt: number
) {
  notificationsStore.setState((s) => ({
    items: [
      { ...payload, id: payload.applicationId, receivedAt },
      ...s.items,
    ].slice(0, 50),
    unread: s.unread + 1,
  }))
}

export function markNotificationsRead() {
  notificationsStore.setState((s) => (s.unread === 0 ? s : { ...s, unread: 0 }))
}

export function clearNotifications() {
  notificationsStore.setState(() => ({ items: [], unread: 0 }))
}
