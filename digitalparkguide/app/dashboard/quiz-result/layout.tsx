import { GuardianPortalSidebar } from '@/components/GuardianPortalSidebar'

export default function QuizResultLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface text-on-surface flex min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      <GuardianPortalSidebar />
      <main className="ml-64 flex-1 flex flex-col min-h-screen">{children}</main>
    </div>
  )
}
