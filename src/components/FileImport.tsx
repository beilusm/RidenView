import { useCallback, useRef, useState } from 'react'
import Papa from 'papaparse'
import { Card } from '@/components/ui/card'
import { Upload, FileText } from 'lucide-react'

interface FileImportProps {
  onDataLoaded: (data: Record<string, string>[]) => void
}

export function FileImport({ onDataLoaded }: FileImportProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadSample = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}sample.csv`)
      const text = await resp.text()
      const results = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      })
      setIsLoading(false)
      if (results.errors.length > 0) {
        setError(`Parse error: ${results.errors[0].message}`)
        return
      }
      if (results.data.length === 0) {
        setError('File is empty or has no valid data rows')
        return
      }
      onDataLoaded(results.data)
    } catch {
      setIsLoading(false)
      setError('Failed to load sample file')
    }
  }, [onDataLoaded])

  const handleFile = useCallback((file: File) => {
    setIsLoading(true)
    setError(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        setIsLoading(false)
        if (results.errors.length > 0) {
          setError(`Parse error: ${results.errors[0].message}`)
          return
        }
        if (results.data.length === 0) {
          setError('File is empty or has no valid data rows')
          return
        }
        onDataLoaded(results.data as Record<string, string>[])
      },
      error(_err: unknown) {
        setIsLoading(false)
        setError('Failed to parse file')
      },
    })
  }, [onDataLoaded])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-52px)] p-6">
      <Card
        className={`w-full max-w-lg p-12 text-center cursor-pointer transition-colors border-2 border-dashed
          ${isDragging ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'}
          ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            {isLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : isDragging ? (
              <FileText className="h-8 w-8 text-primary" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-base font-medium">
              {isLoading ? 'Parsing CSV...' : 'Drop CSV file here or click to browse'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Supports voltage, current, power, temperature waveform data
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <button
            type="button"
            className="mt-2 text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            onClick={(e) => { e.stopPropagation(); loadSample() }}
          >
            Load sample data
          </button>
        </div>
      </Card>
    </div>
  )
}
