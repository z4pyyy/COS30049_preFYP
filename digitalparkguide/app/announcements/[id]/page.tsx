// Public announcement detail — renders structured blocks + attachments
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'

type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'paragraph'; text: string }
  | { type: 'attachment'; name: string; url: string; path: string; size: number; mime: string }

interface Announcement {
  id: string
  title: string
  content: string
  category: string
  published: boolean
  published_at: string | null
  created_at: string
  blocks: Block[] | null
}

export const metadata: Metadata = {
  title: 'Announcement',
  description: 'Official announcement from the Sarawak Biodiversity Unit.',
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function attachmentIcon(mime: string) {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'movie'
  if (mime === 'application/pdf') return 'picture_as_pdf'
  return 'description'
}

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, content, category, published, published_at, created_at, blocks')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()

  if (error || !data) notFound()

  const ann = data as Announcement
  const blocks: Block[] = Array.isArray(ann.blocks) ? ann.blocks : []

  // Legacy fallback: if no blocks but content exists, render content as one paragraph
  const renderBlocks: Block[] =
    blocks.length > 0
      ? blocks
      : ann.content
        ? [{ type: 'paragraph', text: ann.content }]
        : []

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <TopNav active="announcements" />

      <main className="max-w-3xl mx-auto px-6 md:px-0 py-12 md:py-20">
        <Link
          href="/announcements"
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary mb-8 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All announcements
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-error text-white text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-sm">
              {ann.category}
            </span>
            <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-widest">
              {formatDate(ann.published_at ?? ann.created_at)}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline font-black text-primary tracking-tighter leading-tight">
            {ann.title}
          </h1>
        </header>

        {renderBlocks.length === 0 ? (
          <p className="text-secondary italic">No further details provided.</p>
        ) : (
          <article className="space-y-5">
            {renderBlocks.map((b, i) => {
              if (b.type === 'h1') return <h2 key={i} className="text-3xl font-bold text-primary tracking-tight mt-8">{b.text}</h2>
              if (b.type === 'h2') return <h3 key={i} className="text-2xl font-bold text-primary tracking-tight mt-6">{b.text}</h3>
              if (b.type === 'h3') return <h4 key={i} className="text-xl font-semibold text-primary mt-4">{b.text}</h4>
              if (b.type === 'paragraph')
                return (
                  <p key={i} className="text-on-surface leading-relaxed whitespace-pre-wrap">
                    {b.text}
                  </p>
                )
              if (b.type === 'attachment') {
                if (b.mime.startsWith('image/')) {
                  return (
                    <figure key={i} className="my-2">
                      <a href={b.url} target="_blank" rel="noopener noreferrer" className="block group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.url}
                          alt={b.name}
                          className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest max-h-[600px] object-contain"
                        />
                      </a>
                    </figure>
                  )
                }
                if (b.mime.startsWith('video/')) {
                  return (
                    <figure key={i} className="my-2">
                      <video
                        src={b.url}
                        controls
                        className="w-full rounded-xl border border-outline-variant/30 bg-black max-h-[600px]"
                      />
                    </figure>
                  )
                }
                return (
                  <a
                    key={i}
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low transition-colors group"
                  >
                    <div className="h-12 w-12 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary">{attachmentIcon(b.mime)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary truncate group-hover:underline">{b.name}</p>
                      <p className="text-xs text-on-surface-variant">{b.mime} · {formatBytes(b.size)}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">download</span>
                  </a>
                )
              }
              return null
            })}
          </article>
        )}
      </main>

      <footer className="bg-emerald-950 w-full py-12 mt-16">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 sm:px-6 lg:px-12 gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-white">Digital Sentinel</span>
            <p className="text-xs font-light tracking-wide text-emerald-100/50 max-w-[240px]">
              Official training and announcement portal for the Sarawak Forestry Corporation Biodiversity Unit.
            </p>
          </div>
          <p className="text-xs font-light tracking-wide text-emerald-100 opacity-50">© 2024 Sarawak Forestry Corporation. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
