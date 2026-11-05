/**
 * ResultScanner.tsx
 * ─────────────────────────────────────────────────────────────
 * Modal that lets a user upload a result document (Excel, Word,
 * PDF, Photo) OR paste result text directly, and auto-fills
 * the Add Semester subject rows with name, credits, and grades.
 *
 * Includes an interactive preview table where users can edit
 * or adjust any detected grades/credits directly before applying!
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react'
import {
  parseResultFile,
  parseRawText,
  gradeToPoints,
  type ParseResult,
  type ParsedSubject,
  type OcrProgressCallback,
} from '../lib/resultParser'
import type { Grade } from '../lib/grading'

interface ResultScannerProps {
  onApply: (result: ParseResult) => void
  onClose: () => void
}

type ScanMode = 'upload' | 'paste'
type ScanState = 'idle' | 'parsing' | 'preview' | 'error'

const ACCEPTED = '.xlsx,.xls,.docx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff'

const SAMPLE_RESULT_TEXT = `R2021051 MATHEMATICS - III A 3
R2021052 MATHEMATICAL FOUNDATIONS OF COMPUTER SCIENCE B 3
R2021053 SOFTWARE ENGINEERING S 3
R2021054 PYTHON PROGRAMMING A 3
R2021055 DATA STRUCTURES O 3
R2021056 PYTHON PROGRAMMING LAB O 1.5
R2021057 DATA STRUCTURES LAB S 1.5
MC20201 ENVIRONMENTAL SCIENCE COMPLETED 0`

export function ResultScanner({ onApply, onClose }: ResultScannerProps) {
  const [mode, setMode]               = useState<ScanMode>('upload')
  const [scanState, setScanState]     = useState<ScanState>('idle')
  const [ocrPct, setOcrPct]           = useState(0)
  const [ocrStatus, setOcrStatus]     = useState('')
  const [result, setResult]           = useState<ParseResult | null>(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [dragging, setDragging]       = useState(false)
  const [fileName, setFileName]       = useState('')
  const [pastedText, setPastedText]   = useState('')
  const [showRawEditor, setShowRawEditor] = useState(false)
  const [editableRawText, setEditableRawText] = useState('')
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  // ── Handle file upload ─────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setScanState('parsing')
    setOcrPct(0)
    setOcrStatus('Reading document…')
    setErrorMsg('')
    setResult(null)
    setShowRawEditor(false)

    const onProgress: OcrProgressCallback = (pct, status) => {
      setOcrPct(pct)
      setOcrStatus(status)
    }

    try {
      const parsed = await parseResultFile(file, onProgress)
      setResult(parsed)
      setEditableRawText(parsed.rawText || '')
      if (parsed.subjects.length === 0) {
        setShowRawEditor(true)
      }
      setScanState('preview')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unknown error while processing file.')
      setScanState('error')
    }
  }, [])

  // ── Handle pasted text ─────────────────────────────────────
  const handleParsePasted = () => {
    if (!pastedText.trim()) return
    setScanState('parsing')
    setOcrPct(100)
    setOcrStatus('Parsing text…')

    setTimeout(() => {
      try {
        const parsed = parseRawText(pastedText)
        setResult(parsed)
        setEditableRawText(pastedText)
        if (parsed.subjects.length === 0) {
          setShowRawEditor(true)
        }
        setScanState('preview')
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to parse text.')
        setScanState('error')
      }
    }, 150)
  }

  // ── Re-parse edited raw text ───────────────────────────────
  const handleReparseRawText = () => {
    if (!editableRawText.trim()) return
    const parsed = parseRawText(editableRawText)
    setResult(parsed)
    if (parsed.subjects.length > 0) {
      setShowRawEditor(false)
    }
  }

  // ── Direct Row Editing in Preview Table ────────────────────
  const updateSubjectRow = (index: number, field: keyof ParsedSubject, value: any) => {
    if (!result) return
    const updated = [...result.subjects]
    const current = { ...updated[index], [field]: value }

    if (field === 'grade') {
      const g = value as Grade | null
      if (g === 'CP' || g === 'Completed') {
        current.credits = 0
        current.grade_points = null
      } else if (g === 'F') {
        current.credits = 0
        current.grade_points = 0
      } else if (g) {
        if (current.credits === 0) current.credits = 3
        current.grade_points = gradeToPoints(g)
      } else {
        current.grade_points = null
      }
    }

    updated[index] = current
    setResult({ ...result, subjects: updated })
  }

  const deleteSubjectRow = (index: number) => {
    if (!result) return
    const updated = result.subjects.filter((_, i) => i !== index)
    setResult({ ...result, subjects: updated })
  }

  const addSubjectRow = () => {
    if (!result) return
    const newSub: ParsedSubject = {
      name: '',
      credits: 3,
      grade: null,
      grade_points: null,
    }
    setResult({ ...result, subjects: [...result.subjects, newSub] })
  }

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
    if (result && result.subjects.length > 0) {
      onApply(result)
      onClose()
    }
  }

  const handleReset = () => {
    setScanState('idle')
    setResult(null)
    setErrorMsg('')
    setOcrPct(0)
    setShowRawEditor(false)
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[60]"
    >
      <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-[rgb(var(--border))]">

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-primary-600 to-primary-800 flex items-center justify-center text-white text-xl shadow-lg shadow-rose-950/40 border border-rose-400/20 shrink-0">
              📷
            </div>
            <div>
              <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">Scan Result Document</h3>
              <p className="text-xs text-[rgb(var(--text-secondary))]">
                Auto-fill grades from Excel, Word, PDF, Photos, or portal text
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl hover:bg-[rgb(var(--bg-tertiary))] w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]"
          >
            ✕
          </button>
        </div>

        {/* Input Mode Tabs (Upload File vs Paste Text) */}
        {(scanState === 'idle' || scanState === 'error') && (
          <div className="flex border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-primary))]/40 px-4 pt-2 gap-2">
            <button
              onClick={() => { setMode('upload'); handleReset() }}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
                mode === 'upload'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              <span>📁</span> Upload File
            </button>
            <button
              onClick={() => { setMode('paste'); handleReset() }}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
                mode === 'paste'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              <span>📋</span> Paste Portal Text
            </button>
          </div>
        )}

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">

          {/* ── Mode 1: File Upload (Idle / Error) ── */}
          {(scanState === 'idle' || scanState === 'error') && mode === 'upload' && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                  dragging
                    ? 'border-primary-500 bg-primary-500/10 scale-[1.01]'
                    : 'border-[rgb(var(--border))] hover:border-primary-400 hover:bg-[rgb(var(--bg-tertiary))]'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center text-2xl shadow-inner">
                  📄
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm sm:text-base text-[rgb(var(--text-primary))]">
                    Drop your marksheet / result here
                  </p>
                  <p className="text-xs text-[rgb(var(--text-secondary))] mt-1">
                    or click to browse from your device
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                  {['📊 Excel (.xlsx)', '📄 PDF', '📸 Photos (JPG/PNG)', '📝 Word'].map(label => (
                    <span
                      key={label}
                      className="px-2.5 py-1 rounded-full bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))] text-[11px] text-[rgb(var(--text-secondary))] font-medium shadow-2xs"
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

              {/* Error message */}
              {scanState === 'error' && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <span className="shrink-0 text-sm">⚠️</span>
                  <div>
                    <p className="font-semibold">Could not process document</p>
                    <p className="mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Quick tip box */}
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-start gap-2.5">
                <span className="text-blue-500 text-base shrink-0">💡</span>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <p className="font-semibold">Supports All University Results</p>
                  <p className="leading-relaxed opacity-90">
                    Works with JNTUK, JNTUH, AU, Anna Univ, and Autonomous colleges. Both letter grades (S, A, B, O, CP) and numerical marks (85, 74) are recognized!
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── Mode 2: Paste Result Text ── */}
          {(scanState === 'idle' || scanState === 'error') && mode === 'paste' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[rgb(var(--text-primary))]">
                  Paste result text or table from university website:
                </label>
                <button
                  type="button"
                  onClick={() => setPastedText(SAMPLE_RESULT_TEXT)}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-semibold"
                >
                  ✨ Load Example (JNTU)
                </button>
              </div>

              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`Paste directly from jntukresults.edu.in or your college portal...\n\nExample:\nR201101 MATHEMATICS - I A 3\nR201102 APPLIED PHYSICS S 3\nR201105 C PROGRAMMING B 3\nR201111 APPLIED PHYSICS LAB O 1.5`}
                rows={9}
                className="input-field text-xs sm:text-sm font-mono w-full p-3 resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[rgb(var(--text-secondary))]">
                  {pastedText.trim() ? `${pastedText.split('\n').filter(l => l.trim()).length} lines entered` : 'Copy & paste any table format'}
                </span>
                <button
                  type="button"
                  onClick={handleParsePasted}
                  disabled={!pastedText.trim()}
                  className="btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>⚡</span> Parse Grades
                </button>
              </div>
            </div>
          )}

          {/* ── Processing / OCR Animation ── */}
          {scanState === 'parsing' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="38" stroke="rgb(var(--bg-tertiary))" strokeWidth="8" fill="none" />
                  <circle
                    cx="44" cy="44" r="38"
                    stroke="url(#scannerGradientRing)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 38}`}
                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - Math.max(ocrPct, 15) / 100)}`}
                    className="transition-all duration-300"
                  />
                  <defs>
                    <linearGradient id="scannerGradientRing" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fda4af" />
                      <stop offset="50%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#be123c" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-extrabold font-display text-[rgb(var(--text-primary))]">
                    {ocrPct > 0 ? `${ocrPct}%` : '…'}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="font-bold text-[rgb(var(--text-primary))] text-sm sm:text-base">
                  Analyzing Result Document…
                </p>
                <p className="text-xs text-[rgb(var(--text-secondary))] mt-1 capitalize">
                  {ocrStatus || 'Extracting grades and credits…'}
                </p>
                {fileName && (
                  <p className="text-[11px] text-[rgb(var(--text-secondary))] mt-0.5 opacity-70 truncate max-w-xs mx-auto">
                    {fileName}
                  </p>
                )}
              </div>

              <p className="text-[11px] text-[rgb(var(--text-secondary))] opacity-75 max-w-xs text-center bg-[rgb(var(--bg-tertiary))] py-1.5 px-3 rounded-full">
                🔒 Runs 100% in your browser. No files are uploaded to any server.
              </p>
            </div>
          )}

          {/* ── Interactive Editable Preview Table ── */}
          {scanState === 'preview' && result && (
            <div className="space-y-3.5">
              {/* Status Header */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    result.subjects.length > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  }`}>
                    {result.subjects.length > 0 ? `✅ ${result.subjects.length} subjects found` : '⚠️ 0 subjects detected'}
                  </span>

                  {result.detectedSemester && (
                    <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-300 dark:border-blue-800">
                      📅 Semester {result.detectedSemester}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRawEditor(prev => !prev)}
                    className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {showRawEditor ? 'Hide Text' : '📝 View / Edit Extracted Text'}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] underline"
                  >
                    Start Over
                  </button>
                </div>
              </div>

              {/* Editable Text Fallback (Collapsible) */}
              {showRawEditor && (
                <div className="p-3 rounded-xl bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[rgb(var(--text-primary))]">
                      Extracted Text / Manual Correction:
                    </span>
                    <button
                      type="button"
                      onClick={handleReparseRawText}
                      className="text-xs bg-primary-600 hover:bg-primary-700 text-white font-semibold px-2.5 py-1 rounded-md transition-colors"
                    >
                      ⚡ Re-Parse Text
                    </button>
                  </div>
                  <textarea
                    value={editableRawText}
                    onChange={(e) => setEditableRawText(e.target.value)}
                    rows={5}
                    className="input-field text-xs font-mono w-full p-2.5 resize-none leading-relaxed"
                    placeholder="Enter or fix subject lines here (e.g. Mathematics - I A 3)"
                  />
                  <p className="text-[10px] text-[rgb(var(--text-secondary))]">
                    Tip: Format each line as: <code className="bg-[rgb(var(--bg-tertiary))] px-1 rounded">Subject Name [Grade] [Credits]</code>
                  </p>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && result.subjects.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
                  <p className="font-semibold mb-1">OCR did not detect standard grade lines</p>
                  <p className="opacity-90 leading-relaxed">
                    Check the "View / Edit Extracted Text" box above to see what was recognized, or paste the text directly using the "Paste Portal Text" tab.
                  </p>
                </div>
              )}

              {/* Editable Table of detected subjects */}
              {result.subjects.length > 0 ? (
                <div className="space-y-2">
                  <div className="overflow-x-auto rounded-xl border border-[rgb(var(--border))] max-h-72 overflow-y-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-[rgb(var(--bg-tertiary))] sticky top-0 z-10">
                        <tr className="text-left text-[11px] text-[rgb(var(--text-secondary))] uppercase tracking-wider">
                          <th className="py-2.5 px-2 text-center w-8">#</th>
                          <th className="py-2.5 px-2">Subject Name</th>
                          <th className="py-2.5 px-2 text-center w-20">Credits</th>
                          <th className="py-2.5 px-2 text-center w-24">Grade</th>
                          <th className="py-2.5 px-2 text-center w-16">Points</th>
                          <th className="py-2.5 px-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border))]">
                        {result.subjects.map((sub, i) => (
                          <tr key={i} className="hover:bg-[rgb(var(--bg-tertiary))]/40 transition-colors">
                            <td className="py-1.5 px-2 text-center text-[rgb(var(--text-secondary))] font-mono text-xs">
                              {i + 1}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={sub.name}
                                onChange={(e) => updateSubjectRow(i, 'name', e.target.value)}
                                className="input-field text-xs sm:text-sm py-1 w-full font-medium"
                                placeholder="Subject name"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              {sub.grade === 'CP' || sub.grade === 'Completed' ? (
                                <span className="text-xs font-semibold text-[rgb(var(--text-secondary))]">--</span>
                              ) : (
                                <select
                                  value={sub.credits}
                                  onChange={(e) => updateSubjectRow(i, 'credits', parseFloat(e.target.value))}
                                  className="input-field text-xs py-1 w-16 text-center"
                                >
                                  {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(cr => (
                                    <option key={cr} value={cr}>{cr}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <select
                                value={sub.grade === 'Completed' ? 'CP' : (sub.grade || '')}
                                onChange={(e) => updateSubjectRow(i, 'grade', e.target.value ? (e.target.value === 'CP' ? 'Completed' : e.target.value as Grade) : null)}
                                className={`input-field text-xs py-1 font-bold text-center w-22 ${
                                  sub.grade === 'S' || sub.grade === 'A'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : sub.grade === 'F'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : sub.grade === 'CP' || sub.grade === 'Completed'
                                    ? 'text-purple-600 dark:text-purple-400'
                                    : 'text-blue-600 dark:text-blue-400'
                                }`}
                              >
                                <option value="">— Select —</option>
                                <option value="S">S / O (10)</option>
                                <option value="A">A / A+ (9)</option>
                                <option value="B">B / B+ (8)</option>
                                <option value="C">C (7)</option>
                                <option value="D">D (6)</option>
                                <option value="E">E / Pass (5)</option>
                                <option value="F">F / Fail (0)</option>
                                <option value="CP">CP (Audit)</option>
                              </select>
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold text-xs text-[rgb(var(--text-secondary))]">
                              {sub.grade === 'CP' || sub.grade === 'Completed' ? '--' : (sub.grade_points ?? '—')}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => deleteSubjectRow(i)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 p-1 rounded transition-colors"
                                title="Remove this subject"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={addSubjectRow}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>➕</span> Add Another Subject
                    </button>
                    <p className="text-[11px] text-[rgb(var(--text-secondary))]">
                      You can edit any subject, grade, or credit above before auto-filling.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        {scanState === 'preview' && result && result.subjects.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-primary))]/50 gap-3">
            <div className="text-xs text-[rgb(var(--text-secondary))] text-center sm:text-left">
              <span className="font-semibold text-[rgb(var(--text-primary))]">
                {result.subjects.filter(s => s.grade).length} of {result.subjects.length} grades assigned
              </span>
              {result.subjects.some(s => !s.grade) && (
                <span className="text-amber-600 dark:text-amber-400 ml-1 font-medium">
                  • Some grades are empty (you can select them above)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button onClick={onClose} className="btn-ghost text-xs sm:text-sm">
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5 shadow-sm"
              >
                <span>✅</span> Auto-fill {result.subjects.length} Subjects
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
