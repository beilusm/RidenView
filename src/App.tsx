import { useState, useCallback } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FileImport } from '@/components/FileImport'
import { WaveformViewer } from '@/components/WaveformViewer'

function App() {
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])

  const handleDataLoaded = useCallback((data: Record<string, string>[]) => {
    setCsvData(data)
  }, [])

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border/50 px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="RidenView" className="h-8 w-8 rounded shrink-0" />
            <h1 className="text-lg font-semibold tracking-tight shrink-0">RidenView</h1>
            <span className="text-xs text-muted-foreground truncate">Waveform Viewer</span>
          </div>
        </header>
        <main>
          {csvData.length === 0 ? (
            <FileImport onDataLoaded={handleDataLoaded} />
          ) : (
            <WaveformViewer data={csvData} onLoadNew={() => setCsvData([])} />
          )}
        </main>
      </div>
    </TooltipProvider>
  )
}

export default App
