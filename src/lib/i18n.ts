import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ChannelKey } from '@/lib/waveform'

export type Lang = 'en' | 'zh'

export type LoadErrorCode = 'parse' | 'empty' | 'noTime' | 'noRows' | 'read' | 'sample'

const en = {
  title: 'RidenView - Waveform Viewer',
  closeFile: 'Close file',
  samples: (n: string) => `${n} samples`,
  openCsv: 'Open CSV',
  toggleTheme: 'Toggle theme',
  lightMode: 'Light mode',
  darkMode: 'Dark mode',
  switchLang: '切换到中文',
  dropToOpen: 'Drop to open CSV',

  heroTitle: 'Waveform viewer for Riden power supplies',
  heroBody:
    'Open a CSV log to plot voltage, current, power, input voltage and temperature over time. ' +
    'Files are parsed in your browser and never uploaded.',
  parsing: 'Parsing CSV…',
  dropHere: 'Drop a CSV file here',
  orBrowse: 'or click to browse your files',
  chooseFile: 'Choose file',
  loadSample: 'Load sample data',
  columns: 'Columns',

  channels: {
    voltage: 'Output Voltage',
    current: 'Output Current',
    power: 'Output Power',
    inputVoltage: 'Input Voltage',
    temperature: 'Temperature',
  } satisfies Record<ChannelKey, string>,
  min: 'Min',
  avg: 'Avg',
  max: 'Max',
  span: 'Span',
  samplesLabel: 'Samples',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  showStats: 'Show stats',
  hideStats: 'Hide stats',
  hint: 'Drag on the chart to zoom · Scroll to zoom at cursor · Shift + scroll to pan · Drag the window below to navigate',
  noChannels: 'Select at least one channel above to plot it.',
  outputOff: 'OUTPUT OFF',
  outOn: 'OUT ON',
  outOff: 'OUT OFF',
  protection: { 0: 'Normal', 1: 'OVP', 2: 'OCP' } as Record<number, string>,
  protectionOther: (n: number) => `PROT ${n}`,

  errors: {
    parse: (detail?: string) => `Parse error: ${detail ?? ''}`,
    empty: () => 'File is empty or has no valid data rows',
    noTime: () => 'Missing required "time" column',
    noRows: () => 'No rows with a valid timestamp',
    read: () => 'Failed to read file',
    sample: () => 'Failed to load sample file',
  } satisfies Record<LoadErrorCode, (detail?: string) => string>,
}

export type Messages = typeof en

const zh: Messages = {
  title: 'RidenView - 波形查看器',
  closeFile: '关闭文件',
  samples: n => `${n} 个采样点`,
  openCsv: '打开 CSV',
  toggleTheme: '切换主题',
  lightMode: '浅色模式',
  darkMode: '深色模式',
  switchLang: 'Switch to English',
  dropToOpen: '松开以打开 CSV',

  heroTitle: 'Riden 电源波形查看器',
  heroBody: '打开 CSV 日志，按时间绘制输出电压、电流、功率、输入电压和温度曲线。文件只在浏览器本地解析，不会上传。',
  parsing: '正在解析 CSV…',
  dropHere: '将 CSV 文件拖到这里',
  orBrowse: '或点击选择文件',
  chooseFile: '选择文件',
  loadSample: '加载示例数据',
  columns: '数据列',

  channels: {
    voltage: '输出电压',
    current: '输出电流',
    power: '输出功率',
    inputVoltage: '输入电压',
    temperature: '温度',
  },
  min: '最小',
  avg: '平均',
  max: '最大',
  span: '时长',
  samplesLabel: '采样点',
  zoomIn: '放大',
  zoomOut: '缩小',
  resetZoom: '重置缩放',
  showStats: '显示统计',
  hideStats: '隐藏统计',
  hint: '在图表上拖动框选放大 · 滚轮以光标为中心缩放 · Shift + 滚轮平移 · 拖动下方窗口切换区间',
  noChannels: '请在上方至少选择一个通道。',
  outputOff: '输出关闭',
  outOn: '输出 开',
  outOff: '输出 关',
  protection: { 0: '正常', 1: '过压保护', 2: '过流保护' },
  protectionOther: n => `保护 ${n}`,

  errors: {
    parse: detail => `解析错误：${detail ?? ''}`,
    empty: () => '文件为空或没有有效数据行',
    noTime: () => '缺少必需的 "time" 列',
    noRows: () => '没有带有效时间戳的数据行',
    read: () => '读取文件失败',
    sample: () => '加载示例文件失败',
  },
}

export const MESSAGES: Record<Lang, Messages> = { en, zh }

const KEY = 'ridenview-lang'

/** Saved choice first, otherwise Chinese when the device's preferred language is Chinese. */
function initialLang(): Lang {
  const saved = localStorage.getItem(KEY)
  if (saved === 'en' || saved === 'zh') return saved
  const preferred = navigator.languages?.[0] ?? navigator.language ?? ''
  return preferred.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function useLangState() {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    document.title = MESSAGES[lang].title
  }, [lang])

  const toggle = useCallback(() => {
    setLang(l => {
      const next = l === 'zh' ? 'en' : 'zh'
      localStorage.setItem(KEY, next)
      return next
    })
  }, [])

  return { lang, toggle }
}

export const I18nContext = createContext<Messages>(en)

export function useT(): Messages {
  return useContext(I18nContext)
}
