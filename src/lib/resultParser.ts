/**
 * resultParser.ts
 * ─────────────────────────────────────────────────────────────
 * Parses uploaded result files (Excel, Word, PDF, Image) and
 * extracts subject rows with name, credits, grade, grade_points.
 *
 * Strategy (no API key needed – runs fully in browser):
 *   • Excel (.xlsx / .xls)  → SheetJS structural parse
 *   • Word  (.docx)         → mammoth.js text extraction → regex
 *   • Image (.png/.jpg/etc) → Tesseract.js OCR → regex
 *   • PDF                   → Tesseract.js (render not supported
 *                             without pdfjs, so we treat PDF as an
 *                             image if the user converts first, OR
 *                             we do a best-effort text extraction)
 * ─────────────────────────────────────────────────────────────
 */

import * as XLSX from 'xlsx'
import { createWorker } from 'tesseract.js'
import { GRADE_POINTS } from './grading'

// ── Types ────────────────────────────────────────────────────
export interface ParsedSubject {
  name: string
  credits: number
  grade: string | null
  grade_points: number | null
}

export interface ParseResult {
  subjects: ParsedSubject[]
  detectedSemester?: string   // e.g. "3-1" if found in file
  warnings: string[]
}

// ── Grade normalisation map ───────────────────────────────────
const GRADE_ALIASES: Record<string, string> = {
  'O': 'S', 'O+': 'S', 'EX': 'S', 'EXCELLENT': 'S',
  'A+': 'A', 'A1': 'A',
  'B+': 'B', 'B1': 'B',
  'C+': 'C', 'C1': 'C',
  'D+': 'D', 'D1': 'D',
  'E+': 'E', 'E1': 'E', 'PASS': 'E',
  'FAIL': 'F', 'AB': 'F', 'ABSENT': 'F',
  'CP': 'CP', 'COMPLETED': 'CP', 'AUDIT': 'CP', 'COMP': 'CP',
  'S': 'S', 'A': 'A', 'B': 'B', 'C': 'C',
  'D': 'D', 'E': 'E', 'F': 'F',
}

function normaliseGrade(raw: string): string | null {
  const upper = (raw || '').trim().toUpperCase()
  return GRADE_ALIASES[upper] ?? null
}

function gradeToPoints(grade: string | null): number | null {
  if (!grade || grade === 'F' || grade === 'CP') return grade === 'F' ? 0 : null
  return GRADE_POINTS[grade] ?? null
}

// ── Semester detector from text ───────────────────────────────
const SEM_PATTERNS = [
  /\b([1-4])[\s\-–]([1-2])\b/,                     // "3-1", "3 1"
  /(\d)(?:st|nd|rd|th)\s+year[,\s]+(\d)(?:st|nd)/i,
  /semester[\s:]+([1-8])/i,
]

function detectSemesterLabel(text: string): string | undefined {
  for (const pat of SEM_PATTERNS) {
    const m = text.match(pat)
    if (m) {
      if (m[1] && m[2]) return `${m[1]}-${m[2]}`
      // map linear semester number to year-sem
      const n = parseInt(m[1], 10)
      if (!isNaN(n)) {
        const yr = Math.ceil(n / 2)
        const s  = n % 2 === 0 ? 2 : 1
        return `${yr}-${s}`
      }
    }
  }
  return undefined
}

// ── Text → rows parser (regex heuristic) ─────────────────────
/**
 * Attempts to find lines like:
 *   "Data Structures   4   A   8"
 *   "DBMS | 3 | B | 7"
 * Order: name, credits, grade, grade_points
 */
function parseTextRows(text: string): ParsedSubject[] {
  const subjects: ParsedSubject[] = []
  const lines = text.split(/\r?\n/)

  // Pattern: subject-like token, then digits (credits), then grade letter, then digits (gp)
  const rowRe = /([A-Za-z][\w\s&()/.,'-]{3,60?}?)\s*[\t|,]\s*(\d(?:\.\d)?)\s*[\t|,]\s*([A-Za-z+]{1,9})\s*[\t|,]\s*(\d{1,2}(?:\.\d)?)/
  const rowRe2 = /([A-Za-z][\w\s&()/.,'-]{3,60?}?)\s{2,}(\d(?:\.\d)?)\s{2,}([A-Za-z+]{1,9})\s{2,}(\d{1,2}(?:\.\d)?)/

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length < 6) continue
    // Skip header-like lines
    if (/subject|course|credits?|grade|marks|sl\.?\s?no/i.test(trimmed)) continue

    for (const re of [rowRe, rowRe2]) {
      const m = trimmed.match(re)
      if (m) {
        const name   = m[1].trim()
        const cr     = parseFloat(m[2])
        const grade  = normaliseGrade(m[3])
        const gpRaw  = parseFloat(m[4])
        const gp     = isNaN(gpRaw) ? gradeToPoints(grade) : gpRaw

        if (name.length >= 3 && !isNaN(cr) && cr >= 0 && cr <= 6) {
          subjects.push({ name, credits: cr, grade, grade_points: gp })
          break
        }
      }
    }
  }
  return subjects
}

// ── Excel parser ──────────────────────────────────────────────
async function parseExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const warnings: string[] = []
  const subjects: ParsedSubject[] = []
  let detectedSemester: string | undefined

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Try to detect semester from sheet name or first few rows
    const headerText = rows.slice(0, 4).flat().join(' ')
    detectedSemester = detectedSemester ?? detectSemesterLabel(sheetName + ' ' + headerText)

    // Find header row: contains "subject" or "course"
    let headerIdx = -1
    let nameCol = -1, creditsCol = -1, gradeCol = -1, gpCol = -1

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const rowStr = rows[r].map((c: any) => String(c).toLowerCase())
      const nameI   = rowStr.findIndex((c: string) => /subject|course|name/i.test(c))
      const crI     = rowStr.findIndex((c: string) => /credit|cr\b/i.test(c))
      const gradeI  = rowStr.findIndex((c: string) => /\bgrade\b/i.test(c))
      const gpI     = rowStr.findIndex((c: string) => /grade\s*point|gp\b|g\.p/i.test(c))

      if (nameI >= 0) {
        headerIdx  = r
        nameCol    = nameI
        creditsCol = crI >= 0 ? crI : creditsCol
        gradeCol   = gradeI >= 0 ? gradeI : gradeCol
        gpCol      = gpI >= 0 ? gpI : gpCol
        break
      }
    }

    if (headerIdx < 0) {
      // No header found — treat first column as name, try to auto-detect others
      warnings.push(`Sheet "${sheetName}": could not find header row. Attempting auto-detect.`)
      headerIdx  = 0
      nameCol    = 0
      creditsCol = 1
      gradeCol   = 2
      gpCol      = 3
    }

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r]
      const rawName = String(row[nameCol] ?? '').trim()
      if (!rawName || rawName.length < 2) continue
      // skip total / footer rows
      if (/^(total|sgpa|cgpa|result|pass|fail|grand)$/i.test(rawName)) continue

      const rawCredits = parseFloat(String(row[creditsCol] ?? ''))
      const rawGrade   = String(row[gradeCol] ?? '').trim()
      const rawGP      = parseFloat(String(row[gpCol] ?? ''))

      const grade      = normaliseGrade(rawGrade)
      const credits    = isNaN(rawCredits) ? 3 : Math.min(Math.max(rawCredits, 0), 6)
      const gp         = isNaN(rawGP) ? gradeToPoints(grade) : rawGP

      subjects.push({ name: rawName, credits, grade, grade_points: gp })
    }
  }

  if (subjects.length === 0) warnings.push('No subject rows found. Please check the file format.')
  return { subjects, detectedSemester, warnings }
}

// ── Word (.docx) parser ───────────────────────────────────────
async function parseWord(file: File): Promise<ParseResult> {
  // mammoth is a CommonJS module; dynamic import handles it
  const mammoth = await import('mammoth')
  const buffer  = await file.arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer })

  // Extract plain text from html
  const div = document.createElement('div')
  div.innerHTML = html
  const text = div.innerText || div.textContent || ''

  const subjects   = parseTextRows(text)
  const detectedSemester = detectSemesterLabel(text)
  const warnings: string[] = subjects.length === 0
    ? ['Could not find structured grade rows. Try reformatting the Word file as a table.']
    : []

  return { subjects, detectedSemester, warnings }
}

// ── Image / PDF OCR parser (Tesseract.js) ────────────────────
export type OcrProgressCallback = (pct: number, status: string) => void

async function parseImageOCR(file: File, onProgress?: OcrProgressCallback): Promise<ParseResult> {
  const worker = await createWorker('eng', 1, {
    logger: (m: any) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100), 'Recognising text…')
      } else if (onProgress && m.status) {
        onProgress(0, m.status)
      }
    },
  })

  try {
    const { data: { text } } = await worker.recognize(file)
    await worker.terminate()

    const subjects   = parseTextRows(text)
    const detectedSemester = detectSemesterLabel(text)
    const warnings: string[] = subjects.length === 0
      ? ['OCR completed but no grade rows were detected. The image may be low-resolution or use a non-standard format. Try uploading an Excel file instead.']
      : []

    return { subjects, detectedSemester, warnings }
  } catch (err: any) {
    await worker.terminate()
    throw new Error('OCR failed: ' + (err?.message || 'unknown error'))
  }
}

// ── Main entry point ──────────────────────────────────────────
export async function parseResultFile(
  file: File,
  onProgress?: OcrProgressCallback
): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls' || type.includes('spreadsheet') || type.includes('excel')) {
    return parseExcel(file)
  }

  if (ext === 'docx' || type.includes('word') || type.includes('officedocument.wordprocessing')) {
    return parseWord(file)
  }

  if (
    ext === 'pdf' || type === 'application/pdf' ||
    ext === 'png' || ext === 'jpg' || ext === 'jpeg' ||
    ext === 'webp' || ext === 'bmp' || ext === 'tiff' ||
    type.startsWith('image/')
  ) {
    // For PDFs: Tesseract can OCR them directly in newer versions
    return parseImageOCR(file, onProgress)
  }

  throw new Error(`Unsupported file type: .${ext}. Please upload Excel, Word, PDF, or an image.`)
}
