import {
  ClientOnly,
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { QueryClientProvider } from "@tanstack/react-query"

import type { RouterContext } from "@/router"
import { queryClient } from "@/lib/queryClient"
import { Navbar } from "@/components/Navbar"
import { SocketManager } from "@/components/SocketManager"
import { Toaster } from "@/components/ui/sonner"
import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JobBoard" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">
        The requested page could not be found.
      </p>
    </div>
  ),
  // App chrome (uses stores/effects) — rendered on the client in SPA mode.
  component: RootLayout,
  // Pure HTML skeleton — pre-rendered on the server, so it must not use hooks.
  shellComponent: RootDocument,
})

function RootLayout() {
  // The session lives in a cookie and the socket is client-only, so the whole
  // app is a client-rendered SPA. ClientOnly keeps it out of the server shell
  // render (which would otherwise crash on store/effect hooks).
  return (
    <ClientOnly fallback={<ShellFallback />}>
      <QueryClientProvider client={queryClient}>
        <SocketManager />
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </main>
        <Toaster richColors position="top-right" />
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            { name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
          ]}
        />
      </QueryClientProvider>
    </ClientOnly>
  )
}

function ShellFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading…</div>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
