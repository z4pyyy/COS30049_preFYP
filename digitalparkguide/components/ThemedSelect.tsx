'use client'

import { type ReactNode } from 'react'

interface BaseProps {
  disabled?: boolean
  className?: string
  name?: string
}

interface ControlledProps extends BaseProps {
  value: string
  onChange: (v: string) => void
  defaultValue?: never
}

interface UncontrolledProps extends BaseProps {
  defaultValue: string
  value?: never
  onChange?: (v: string) => void
}

type OptionItem = { value: string; label: string; disabled?: boolean }

interface WithOptions {
  options: OptionItem[]
  children?: never
}

interface WithChildren {
  children: ReactNode
  options?: never
}

type Props = (ControlledProps | UncontrolledProps) & (WithOptions | WithChildren)

export const THEMED_SELECT_CLASSES =
  'appearance-none w-full pl-3 pr-8 py-2 text-sm bg-white border border-[#d1d9e0] rounded-lg font-medium text-[#1B3A24] hover:border-[#2D6A3F] focus:outline-none focus:border-[#2D6A3F] focus:ring-1 focus:ring-[#2D6A3F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer'

export default function ThemedSelect(props: Props) {
  const { disabled, className = '', name } = props

  return (
    <div className={`relative ${className}`}>
      <select
        {...('value' in props && props.value !== undefined ? { value: props.value } : {})}
        {...('defaultValue' in props && props.defaultValue !== undefined ? { defaultValue: props.defaultValue } : {})}
        onChange={e => props.onChange?.(e.target.value)}
        disabled={disabled}
        name={name}
        className={THEMED_SELECT_CLASSES}
      >
        {'children' in props && props.children
          ? props.children
          : (props as { options: OptionItem[] }).options?.map(o => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
      </select>
      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-base text-[#94a3b8] pointer-events-none">
        expand_more
      </span>
    </div>
  )
}
