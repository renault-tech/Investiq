import { PlatformShell } from "@/components/layout/PlatformShell"
import { QueryProvider } from "@/lib/QueryProvider"

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PlatformShell>{children}</PlatformShell>
    </QueryProvider>
  )
}
