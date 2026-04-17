// Rich text editor with markdown support

'use client'

import { useState, useRef } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter module content...',
  minHeight = 'min-h-64',
}: RichTextEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.substring(start, end)
    const newValue =
      value.substring(0, start) +
      before +
      selected +
      after +
      value.substring(end)

    onChange(newValue)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + before.length + selected.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab support in textarea
    if (e.key === 'Tab') {
      e.preventDefault()
      insertMarkdown('  ')
    }
  }

  const toolbar = [
    {
      label: 'Bold',
      icon: 'B',
      action: () => insertMarkdown('**', '**'),
      title: 'Ctrl+B',
    },
    {
      label: 'Italic',
      icon: 'I',
      action: () => insertMarkdown('*', '*'),
      title: 'Ctrl+I',
    },
    {
      label: 'Underline',
      icon: 'U',
      action: () => insertMarkdown('<u>', '</u>'),
      title: 'Ctrl+U',
    },
    { label: 'sep', icon: '|', action: () => {}, title: '' },
    {
      label: 'H1',
      icon: 'H₁',
      action: () => insertMarkdown('# '),
      title: 'Heading 1',
    },
    {
      label: 'H2',
      icon: 'H₂',
      action: () => insertMarkdown('## '),
      title: 'Heading 2',
    },
    {
      label: 'H3',
      icon: 'H₃',
      action: () => insertMarkdown('### '),
      title: 'Heading 3',
    },
    { label: 'sep', icon: '|', action: () => {}, title: '' },
    {
      label: 'Bullet List',
      icon: '•',
      action: () => insertMarkdown('- '),
      title: 'Bullet list',
    },
    {
      label: 'Numbered List',
      icon: '1',
      action: () => insertMarkdown('1. '),
      title: 'Numbered list',
    },
    {
      label: 'Code',
      icon: '<>',
      action: () => insertMarkdown('```\n', '\n```'),
      title: 'Code block',
    },
    {
      label: 'Link',
      icon: '🔗',
      action: () => insertMarkdown('[text](url)'),
      title: 'Insert link',
    },
  ]

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-t-lg">
        {toolbar.map((btn, idx) => {
          if (btn.label === 'sep') {
            return (
              <div
                key={`sep-${idx}`}
                className="w-px h-6 bg-[#cbd5e1] mx-2"
              />
            )
          }
          return (
            <button
              key={btn.label}
              onClick={btn.action}
              title={btn.title}
              className="px-3 py-1.5 text-sm font-medium text-[#1B3A24] hover:bg-[#e2e8f0] active:bg-[#cbd5e1] rounded transition-colors"
            >
              {btn.icon}
            </button>
          )
        })}

        <div className="flex-1" />

        {/* Preview Toggle */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          title="Toggle preview"
          className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
            showPreview
              ? 'bg-[#2D6A3F] text-white'
              : 'text-[#1B3A24] hover:bg-[#e2e8f0]'
          }`}
        >
          {showPreview ? '📝 Edit' : '👁️ Preview'}
        </button>
      </div>

      {/* Editor / Preview */}
      <div className="relative border border-t-0 border-[#e2e8f0] rounded-b-lg overflow-hidden">
        {!showPreview ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`
              w-full ${minHeight} p-4
              font-mono text-sm
              border-0 resize-none
              focus:outline-none focus:ring-0
              bg-white
            `}
          />
        ) : (
          <div
            className={`
              w-full ${minHeight} p-4
              prose prose-sm max-w-none
              overflow-y-auto
            `}
          >
            <MarkdownPreview content={value} />
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-[#64748b]">
        Markdown supported. Use **bold**, *italic*, [links](url), and more.
      </p>
    </div>
  )
}

/**
 * Simple markdown to HTML converter
 * Supports: headings, bold, italic, lists, code blocks, links
 */
function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      let code = ''
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        code += lines[i] + '\n'
        i++
      }
      elements.push(
        <pre key={`code-${i}`} className="bg-[#1B3A24] text-[#8DC63F] p-3 rounded text-xs overflow-x-auto">
          <code>{code}</code>
        </pre>
      )
      i++
      continue
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl font-bold text-[#1B3A24] mt-4 mb-2">
          {parseInlineMarkdown(line.substring(2))}
        </h1>
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-xl font-bold text-[#1B3A24] mt-3 mb-2">
          {parseInlineMarkdown(line.substring(3))}
        </h2>
      )
      i++
      continue
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-lg font-bold text-[#1B3A24] mt-3 mb-1">
          {parseInlineMarkdown(line.substring(4))}
        </h3>
      )
      i++
      continue
    }

    // Lists
    if (line.startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(
          <li key={`item-${i}`} className="ml-4">
            {parseInlineMarkdown(lines[i].substring(2))}
          </li>
        )
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc mb-2">
          {items}
        </ul>
      )
      continue
    }

    if (line.match(/^\d+\. /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(
          <li key={`item-${i}`} className="ml-4">
            {parseInlineMarkdown(lines[i].replace(/^\d+\. /, ''))}
          </li>
        )
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal mb-2">
          {items}
        </ol>
      )
      continue
    }

    // Paragraphs
    if (line.trim()) {
      elements.push(
        <p key={`p-${i}`} className="mb-3 text-[#475569] leading-relaxed">
          {parseInlineMarkdown(line)}
        </p>
      )
    }

    i++
  }

  return <div className="space-y-2">{elements}</div>
}

/**
 * Parse inline markdown: bold, italic, links, underline
 */
function parseInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  // Bold: **text**
  const boldRegex = /\*\*(.+?)\*\*/g
  let match
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    parts.push(
      <strong key={`bold-${match.index}`} className="font-semibold text-[#1B3A24]">
        {match[1]}
      </strong>
    )
    lastIndex = match.index + match[0].length
  }

  // Italic: *text*
  const italicRegex = /\*(.+?)\*/g
  let remainingText = text.substring(lastIndex)
  while ((match = italicRegex.exec(remainingText)) !== null) {
    if (match.index > 0) {
      parts.push(remainingText.substring(0, match.index))
    }
    parts.push(
      <em key={`italic-${match.index}`} className="italic">
        {match[1]}
      </em>
    )
    remainingText = remainingText.substring(match.index + match[0].length)
  }

  if (remainingText) {
    parts.push(remainingText)
  }

  if (parts.length === 0) {
    return text
  }

  return parts
}