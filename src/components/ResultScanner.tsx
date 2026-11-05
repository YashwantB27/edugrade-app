/**
 * ResultScanner.tsx
 * ─────────────────────────────────────────────────────────────
 * Modal that lets a user upload a result document (Excel, Word,
 * PDF, or photo) and auto-fills the Add-Semester subject rows.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react'
import { parseResultFile, type ParseResult, type OcrProgressCallback } from '../lib/resultParser'

interface ResultScannerProps {
  onApply: (result: ParseResult) => void
  onClose: () => void
}

type ScanState = 'idle' | 'parsing' | 'preview' | 'error'

const ACCEPTED = '.xlsx,.xls,.docx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff'

export function ResultScanner({ onApply, onClose }: ResultScannerProps) {
  const [scanState, setScanState]     = useState<ScanState>('idle')
  const [ocrPct, setOcrPct]           = useState(0)
  const [ocrStatus, setOcrStatus]     = useState('')
  const [result, setResult]           = useState<ParseResult | null>(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [dragging, setDragging]       = useState(false)
  const [fileName, setFileName]       = useState('')
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setScanState('parsing')
    setOcrPct(0)
    setOcrStatus('Loading file…')
    setErrorMsg('')
    setResult(null)

    const onProgress: OcrProgressCallback = (pct, status) => {
      setOcrPct(pct)
      setOcrStatus(status)
    }

    try {
      const parsed = await parseResultFile(file, onProgress)
      setResult(parsed)
      setScanState('preview')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unknown error while parsing file.')
      setScanState('error')
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const handleApply = () => {
    if (result) {
      onApply(result)
      onClose()
    }
  }

  const handleRetry = () => {
    setScanState('idle')
    setResult(null)
    setErrorMsg('')
    setOcrPct(0)
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
    >
      <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-sm">
              📷
            </div>
            <div>
              <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">Scan Result Document</h3>
              <p className="text-xs text-[rgb(var(--text-secondary))]">Excel · Word · PDF · Photo — no API key needed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl hover:bg-[rgb(var(--bg-tertiary))] w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* ── Idle: Drop Zone ── */}
          {(scanState === 'idle' || scanState === 'error') && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                  dragging
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-[rgb(var(--border))] hover:border-primary-400 hover:bg-[rgb(var(--bg-tertiary))]'
                }`}
              >
                <div className="text-5xl">📂</div>
                <div className="text-center">
                  <p className="font-semibold text-[rgb(var(--text-primary))]">Drop your result file here</p>
                  <p className="text-sm text-[rgb(var(--text-secondary))] mt-1">or click to browse</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {['📊 Excel', '📝 Word', '📄 PDF', '📸 Photo'].map(label => (
                    <span
                      key={label}
                      className="px-3 py-1 rounded-full bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-secondary))] font-medium"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  onChange={handleInputChange}
                  className="hidden"
                />
              </div>

              {/* Error state */}
              {scanState === 'error' && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <p className="font-semibold mb-1">Could not parse file</p>
                    <p className="text-xs">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">📌 Tips for best results</p>
                <ul className="text-xs text-blue-700/80 dark:text-blue-300/80 space-y-1 list-disc list-inside">
                  <li><strong>Excel</strong> files work best — make sure columns are labelled "Subject", "Credits", "Grade"</li>
                  <li><strong>Photos</strong> should be clear, well-lit, and not blurry. Hold camera steady.</li>
                  <li><strong>PDFs</strong> from university portals (digital) work better than scanned PDFs.</li>
                  <li>Always review auto-filled data before saving — you can edit any field.</li>
                </ul>
              </div>
            </>
          )}

          {/* ── Parsing / OCR Progress ── */}
          {scanState === 'parsing' && (
            <div className="flex flex-col items-center justify-center gap-5 py-10">
              <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" stroke="rgb(var(--bg-tertiary))" strokeWidth="8" fill="none" />
                  <circle
                    cx="40" cy="40" r="34"
                    stroke="url(#scanGrad)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - ocrPct / 100)}`}
                    className="transition-all duration-300"
                  />
                  <defs>
                    <linearGradient id="scanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-[rgb(var(--text-primary))]">
                    {ocrPct > 0 ? `${ocrPct}%` : '…'}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-[rgb(var(--text-primary))]">Scanning your result…</p>
                <p className="text-sm text-[rgb(var(--text-secondary))] mt-1 capitalize">{ocrStatus || 'Initialising…'}</p>
                <p className="text-xs text-[rgb(var(--text-secondary))] mt-0.5 opacity-70">{fileName}</p>
              </div>
              <p className="text-xs text-[rgb(var(--text-secondary))] opacity-60 max-w-xs text-center">
                This runs entirely in your browser — no data is sent to any server.
              </p>
            </div>
          )}

          {/* ── Preview of parsed results ── */}
          {scanState === 'preview' && result && (
            <>
              {/* Stats bar */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                  ✅ {result.subjects.length} subjects detected
                </span>
                {result.detectedSemester && (
                  <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800">
                    📅 Semester {result.detectedSemester} detected
                  </span>
                )}
                <button
                  onClick={handleRetry}
                  className="ml-auto text-xs text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] underline underline-offset-2"
                >
                  Upload a different file
                </button>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i}>⚠️ {w}</p>
                  ))}
                </div>
              )}

              {/* Subject table preview */}
              {result.subjects.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[rgb(var(--border))]">
                  <table className="w-full text-sm">
                    <thead className="bg-[rgb(var(--bg-tertiary))]">
                      <tr className="text-left text-xs text-[rgb(var(--text-secondary))] uppercase tracking-wider">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Credits</th>
                        <th className="py-2.5 px-3">Grade</th>
                        <th className="py-2.5 px-3">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border))]">
                      {result.subjects.map((sub, i) => (
                        <tr key={i} className="hover:bg-[rgb(var(--bg-tertiary))] transition-colors">
                          <td className="py-2 px-3 text-[rgb(var(--text-secondary))] text-xs">{i + 1}</td>
                          <td className="py-2 px-3 font-medium text-[rgb(var(--text-primary))]">{sub.name}</td>
                          <td className="py-2 px-3 text-[rgb(var(--text-secondary))]">{sub.credits}</td>
                          <td className="py-2 px-3">
                            {sub.grade ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                sub.grade === 'S' || sub.grade === 'A'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : sub.grade === 'F'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                  : sub.grade === 'CP'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              }`}>
                                {sub.grade}
                              </span>
                            ) : (
                              <span className="text-[rgb(var(--text-secondary))] text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[rgb(var(--text-secondary))]">
                            {sub.grade_points !== null ? sub.grade_points : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-[rgb(var(--text-secondary))]">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="text-sm font-medium">No subjects could be extracted.</p>
                  <p className="text-xs mt-1">Try uploading an Excel (.xlsx) file for best results.</p>
                  <button onClick={handleRetry} className="mt-4 btn-secondary text-xs">
                    Try another file
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {scanState === 'preview' && result && result.subjects.length > 0 && (
          <div className="flex items-center justify-between p-5 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-primary))]/50">
            <p className="text-xs text-[rgb(var(--text-secondary))] max-w-xs">
              Data will be pre-filled in the form. You can edit any field before saving.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleApply}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <span>✅</span> Use These Grades
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
