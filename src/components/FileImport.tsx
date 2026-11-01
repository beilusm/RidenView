import { FileUp, FlaskConical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import type { LoadError } from '@/hooks/useCsvLoader'
import { cn } from '@/lib/utils'

interface FileImportProps {
  onPick: () => void
  onSample: () => void
  isLoading: boolean
  isDragging: boolean
  error: LoadError | null
}

const REQUIRED = ['time', 'voltage', 'current', 'power', 'inputVoltage', 'temperature']
const OPTIONAL = ['outputEnable', 'protectionState', 'activeSlot']

export function FileImport({ onPick, onSample, isLoading, isDragging, error }: FileImportProps) {
  const t = useT()
  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-sky-500/15 blur-3xl" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-16 pb-12 text-center sm:pt-24">
        <img
          src={`${import.meta.env.BASE_URL}favicon.png`}
          alt=""
          className="size-14 rounded-2xl shadow-lg ring-1 ring-foreground/10"
        />
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t.heroTitle}
        </h2>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground text-balance sm:text-base">
          {t.heroBody}
        </p>

        <div
          role="button"
          tabIndex={0}
          onClick={onPick}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick())}
          className={cn(
            'mt-10 w-full max-w-xl cursor-pointer rounded-2xl border-2 border-dashed bg-card/60 p-10 backdrop-blur transition-colors',
            'outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/25',
            isLoading && 'pointer-events-none opacity-70',
          )}
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {isLoading ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
          </div>
          <p className="mt-4 font-medium">{isLoading ? t.parsing : t.dropHere}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.orBrowse}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button
              size="lg"
              className="px-4"
              disabled={isLoading}
              onClick={e => { e.stopPropagation(); onPick() }}
            >
              <FileUp /> {t.chooseFile}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-4"
              disabled={isLoading}
              onClick={e => { e.stopPropagation(); onSample() }}
            >
              <FlaskConical /> {t.loadSample}
            </Button>
          </div>

          {error && (
            <p className="mt-5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t.errors[error.code](error.detail)}</p>
          )}
        </div>

        <div className="mt-8 flex max-w-xl flex-wrap items-center justify-center gap-1.5 text-xs">
          <span className="mr-1 text-muted-foreground">{t.columns}</span>
          {REQUIRED.map(c => (
            <code key={c} className="rounded-md border bg-card px-1.5 py-0.5 font-mono">{c}</code>
          ))}
          {OPTIONAL.map(c => (
            <code key={c} className="rounded-md border border-dashed px-1.5 py-0.5 font-mono text-muted-foreground">{c}</code>
          ))}
        </div>
      </div>
    </div>
  )
}
