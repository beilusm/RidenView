import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, FileUp, Languages, Moon, Sun, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FileImport } from '@/components/FileImport'
import { WaveformViewer } from '@/components/WaveformViewer'
import { useCsvLoader } from '@/hooks/useCsvLoader'
import { useTheme } from '@/hooks/useTheme'
import { I18nContext, MESSAGES, useLangState } from '@/lib/i18n'
import { fmtBytes, fmtDuration, type Dataset } from '@/lib/waveform'

function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [loadId, setLoadId] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { theme, toggle: toggleTheme } = useTheme()
  const { lang, toggle: toggleLang } = useLangState()
  const t = MESSAGES[lang]

  const onLoaded = useCallback((d: Dataset) => {
    setDataset(d)
    setLoadId(i => i + 1)
  }, [])
  const { loadFile, loadSample, isLoading, error } = useCsvLoader(onLoaded)

  const pickFile = useCallback(() => inputRef.current?.click(), [])

  // Accept a dropped file anywhere in the window.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setIsDragging(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setIsDragging(false)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setIsDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) loadFile(file)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [loadFile])

  const samples = dataset?.samples
  const duration = samples ? samples[samples.length - 1].ts - samples[0].ts : 0

  return (
    <I18nContext.Provider value={t}>
      <TooltipProvider>
        <div className="min-h-dvh bg-background text-foreground">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) loadFile(file)
              e.target.value = ''
            }}
          />

          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
            <div className="flex shrink-0 items-center gap-2.5">
              <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="size-7 rounded-md" />
              <h1 className="text-[15px] font-semibold tracking-tight">RidenView</h1>
            </div>

            {dataset && samples && (
              <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-2.5 py-1 text-xs">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{dataset.name}</span>
                <span className="hidden shrink-0 text-muted-foreground md:inline">
                  {dataset.size != null && <>{fmtBytes(dataset.size)} · </>}
                  {t.samples(samples.length.toLocaleString())} · {fmtDuration(duration)}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={t.closeFile}
                        onClick={() => setDataset(null)}
                        className="-mr-1 ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      />
                    }
                  >
                    <X className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>{t.closeFile}</TooltipContent>
                </Tooltip>
              </div>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {dataset && error && (
                <span className="hidden max-w-64 truncate rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive sm:inline">
                  {t.errors[error.code](error.detail)}
                </span>
              )}
              {dataset && (
                <Button variant="outline" size="sm" onClick={pickFile} disabled={isLoading}>
                  <FileUp /> <span className="hidden sm:inline">{t.openCsv}</span>
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={<Button variant="ghost" size="sm" aria-label={t.switchLang} onClick={toggleLang} />}
                >
                  <Languages /> {lang === 'zh' ? 'EN' : '中'}
                </TooltipTrigger>
                <TooltipContent>{t.switchLang}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label={t.toggleTheme} onClick={toggleTheme} />}
                >
                  {theme === 'dark' ? <Sun /> : <Moon />}
                </TooltipTrigger>
                <TooltipContent>{theme === 'dark' ? t.lightMode : t.darkMode}</TooltipContent>
              </Tooltip>
            </div>
          </header>

          <main>
            {dataset ? (
              <WaveformViewer key={loadId} samples={dataset.samples} />
            ) : (
              <FileImport
                onPick={pickFile}
                onSample={loadSample}
                isLoading={isLoading}
                isDragging={isDragging}
                error={error}
              />
            )}
          </main>

          {isDragging && dataset && (
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card/80 px-16 py-12">
                <FileUp className="size-8 text-primary" />
                <p className="font-medium">{t.dropToOpen}</p>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </I18nContext.Provider>
  )
}

export default App
