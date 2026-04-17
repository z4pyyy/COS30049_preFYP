import { redirect } from 'next/navigation'

export default function TracksPage() {
  redirect('/dashboard?action=tracks')
}
