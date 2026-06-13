import { io, type Socket } from "socket.io-client"
import { API_URL } from "@/lib/api"
import type { NewApplicationPayload } from "@/lib/types"

interface ServerToClientEvents {
  new_application: (payload: NewApplicationPayload) => void
}

let socket: Socket<ServerToClientEvents> | null = null

export function connectSocket(token: string): Socket<ServerToClientEvents> {
  if (socket) {
    if (socket.auth && (socket.auth as { token?: string }).token === token) {
      return socket
    }
    disconnectSocket()
  }
  socket = io(API_URL, { auth: { token } })
  return socket
}

export function getSocket(): Socket<ServerToClientEvents> | null {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
