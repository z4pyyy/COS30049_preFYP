// HoD Training Modules Management Page
// Redirected to main dashboard

import { redirect } from 'next/navigation'

export default function ModuleManagementPage() {
  redirect('/dashboard?action=modules')
}