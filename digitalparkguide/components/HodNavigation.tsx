// HoD Dashboard Navigation Component

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    label: 'Applications',
    href: '/dashboard/hod',
    icon: '📋',
    description: 'Review guide/ranger applications',
  },
  {
    label: 'Training Modules',
    href: '/dashboard/hod/modules',
    icon: '📚',
    description: 'Manage training modules',
  },
  {
    label: 'Tracks',
    href: '/dashboard/tracks',
    icon: '🏆',
    description: 'Manage certification tracks',
  },
  {
    label: 'Announcements',
    href: '/dashboard/hod/announcements',
    icon: '📢',
    description: 'Send platform announcements',
  },
]

export function HodSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-64 h-screen bg-white border-r border-[#e2e8f0] p-6 space-y-2 fixed left-0 top-0 hidden lg:block">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-[#1B3A24] flex items-center gap-2">
          👤 HoD Dashboard
        </h2>
      </div>

      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              block p-3 rounded-lg transition-colors
              ${
                isActive
                  ? 'bg-[#2D6A3F] text-white'
                  : 'text-[#1B3A24] hover:bg-[#f8fafc]'
              }
            `}
          >
            <div className="flex items-center gap-2 font-medium">
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </div>
            <p
              className={`
                text-xs mt-1 ${
                  isActive ? 'text-emerald-100' : 'text-[#64748b]'
                }
              `}
            >
              {item.description}
            </p>
          </Link>
        )
      })}
    </nav>
  )
}

export function HodMobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] p-3 flex justify-around">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs font-medium transition-colors
              ${
                isActive
                  ? 'text-[#2D6A3F] bg-[#f0f4f8]'
                  : 'text-[#64748b] hover:bg-[#f8fafc]'
              }
            `}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}