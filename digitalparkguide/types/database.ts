export interface GeneralModule {
  id: string
  title: string
  description: string
  content: string
  tpa_ids: string[]
  order_index: number
  duration_hours: number
  is_active: boolean
  price_myr: number
  created_at: string
  updated_at: string
}

export interface GeneralModuleCompletion {
  id: string
  user_id: string
  module_id: string
  completed_at: string
}

export interface GeneralModuleEnrollment {
  id: string
  guide_id: string
  module_id: string
  status: 'active' | 'cancelled'
  payment_status: 'pending' | 'paid'
  stripe_session_id: string | null
  paid_at: string | null
  created_at: string
}

export interface GeneralModuleWithStatus extends GeneralModule {
  completed: boolean
  completed_at: string | null
  enrolled: boolean
  paid: boolean
  paid_at: string | null
}

export interface PrerequisiteStatus {
  satisfied: boolean
  completed_count: number
  total_count: number
  incomplete_modules: GeneralModule[]
}

export interface TrackPrerequisiteStatus {
  satisfied: boolean
  prerequisites: Array<{
    module: GeneralModule
    completed: boolean
    completed_at: string | null
    enrolled: boolean
    paid: boolean
  }>
}
