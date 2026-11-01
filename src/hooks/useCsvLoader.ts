import { useCallback, useState } from 'react'
import Papa from 'papaparse'
import type { LoadErrorCode } from '@/lib/i18n'
import { toSamples, type Dataset } from '@/lib/waveform'

export interface LoadError {
  code: LoadErrorCode
  detail?: string
}

class LoadFailure extends Error {
  readonly info: LoadError
  constructor(code: LoadErrorCode, detail?: string) {
    super(code)
    this.info = { code, detail }
  }
}

function toDataset(
  results: Papa.ParseResult<Record<string, string>>,
  name: string,
  size: number | null,
): Dataset {
  if (results.errors.length > 0 && results.data.length === 0) {
    throw new LoadFailure('parse', results.errors[0].message)
  }
  if (results.data.length === 0) throw new LoadFailure('empty')
  if (!results.meta.fields?.includes('time')) throw new LoadFailure('noTime')
  const samples = toSamples(results.data)
  if (samples.length === 0) throw new LoadFailure('noRows')
  return { name, size, samples }
}

export function useCsvLoader(onLoaded: (dataset: Dataset) => void) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<LoadError | null>(null)

  const finish = useCallback((build: () => Dataset) => {
    setIsLoading(false)
    try {
      onLoaded(build())
    } catch (e) {
      setError(e instanceof LoadFailure ? e.info : { code: 'parse' })
    }
  }, [onLoaded])

  const loadFile = useCallback((file: File) => {
    setIsLoading(true)
    setError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => finish(() => toDataset(results, file.name, file.size)),
      error: () => {
        setIsLoading(false)
        setError({ code: 'read' })
      },
    })
  }, [finish])

  const loadSample = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}sample.csv`)
      if (!resp.ok) throw new Error()
      const text = await resp.text()
      const results = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
      finish(() => toDataset(results, 'sample.csv', text.length))
    } catch {
      setIsLoading(false)
      setError({ code: 'sample' })
    }
  }, [finish])

  return { loadFile, loadSample, isLoading, error }
}
