import TopNavClient from '@/components/TopNavClient'

export default function SeniorGuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNavClient active="training" />
      {children}
    </>
  )
}
