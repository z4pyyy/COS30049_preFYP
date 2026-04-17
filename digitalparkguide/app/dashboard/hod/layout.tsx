// HoD Section Layout

import { HodSidebar, HodMobileNav } from '@/components/HodNavigation'

export default function HodLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f8fafc]">
      {/* Desktop Sidebar */}
      <HodSidebar />

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 pb-20 lg:pb-0">
        {children}
      </div>

      {/* Mobile Bottom Navigation */}
      <HodMobileNav />
    </div>
  )
}