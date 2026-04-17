import { redirect } from 'next/navigation'

export default function LegacyHodTracksPage() {
  redirect('/dashboard/tracks')
}