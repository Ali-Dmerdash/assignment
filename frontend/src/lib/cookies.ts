export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const prefix = `${encodeURIComponent(name)}=`
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length))
    }
  }
  return null
}

export function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return
  const secure = location.protocol === "https:" ? "; Secure" : ""
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}` +
    `; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`
}
