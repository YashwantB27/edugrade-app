/**
 * resultParser.ts
 * ─────────────────────────────────────────────────────────────
 * Multi-format result parser for Indian universities & colleges:
 *   • Excel (.xlsx / .xls) -> SheetJS structural column parse
 *   • Word  (.docx)        -> mammoth.js HTML text -> smart parse
 *   • PDF   (.pdf)         -> pdfjs-dist digital text extraction
 *                             (with canvas OCR fallback if scanned)
 *   • Image (JPG/PNG/etc)  -> Canvas contrast boost -> Tesseract OCR
 *   • Direct pasted text   -> Instant smart regex parsing
 *
 * Runs 100% in browser. Zero API keys. Private & offline-friendly.
 * ─────────────────────────────────────────────────────────────
 */

import * as XLSX from 'xlsx'
import { createWorker } from 'tesseract.js'
import { GRADE_POINTS } from './grading'
import type { Grade } from './grading'

// ── Types ────────────────────────────────────────────────────
export interface ParsedSubject {
  name: string
  credits: number
  grade: Grade | null
  grade_points: number | null
}

export interface ParseResult {
  subjects: ParsedSubject[]
  detectedSemester?: string
  warnings: string[]
  rawText?: string
}

export type OcrProgressCallback = (pct: number, status: string) => void

// ── Grade normalisation map ───────────────────────────────────
const GRADE_ALIASES: Record<string, Grade> = {
  // Outstanding / 10 points
  'O': 'S',
  'O+': 'S',
  'OUTSTANDING': 'S',
  'EX': 'S',
  'EXCELLENT': 'S',
  'S+': 'S',
  'S': 'S',
  '10': 'S',
  '10.0': 'S',

  // A grade / 9 points (or 8 in R20, mapped to standard 10-pt)
  'A+': 'A',
  'A': 'A',
  'A1': 'A',
  'VERY GOOD': 'A',
  '9': 'A',
  '9.0': 'A',

  // B grade / 8 points
  'B+': 'B',
  'B': 'B',
  'B1': 'B',
  'GOOD': 'B',
  '8': 'B',
  '8.0': 'B',

  // C grade / 7 points
  'C+': 'C',
  'C': 'C',
  'C1': 'C',
  'FAIR': 'C',
  'ABOVE AVERAGE': 'C',
  '7': 'C',
  '7.0': 'C',

  // D grade / 6 points
  'D+': 'D',
  'D': 'D',
  'D1': 'D',
  'AVERAGE': 'D',
  '6': 'D',
  '6.0': 'D',

  // E grade / Pass / 5 points
  'E+': 'E',
  'E': 'E',
  'E1': 'E',
  'PASS': 'E',
  'PASSED': 'E',
  'P': 'E',
  '5': 'E',
  '5.0': 'E',

  // Fail / 0 points
  'FAIL': 'F',
  'FAILED': 'F',
  'F': 'F',
  'AB': 'F',
  'ABSENT': 'F',
  'NA': 'F',
  '0': 'F',
  '0.0': 'F',

  // Audit / CP courses
  'CP': 'CP',
  'COMPLETED': 'Completed',
  'AUDIT': 'Completed',
  'COMP': 'Completed',
  'SATISFACTORY': 'Completed',
}

export function normaliseGrade(raw: string): Grade | null {
  const clean = (raw || '').trim().toUpperCase().replace(/[.,;:()]/g, '')
  if (GRADE_ALIASES[clean]) {
    return GRADE_ALIASES[clean]
  }

  // Marks to grade conversion (if a percentage / marks number is passed)
  const num = parseFloat(clean)
  if (!isNaN(num) && /^\d{2,3}(\.\d+)?$/.test(clean)) {
    if (num >= 90) return 'S'
    if (num >= 80) return 'A'
    if (num >= 70) return 'B'
    if (num >= 60) return 'C'
    if (num >= 50) return 'D'
    if (num >= 40) return 'E'
    return 'F'
  }

  return null
}

export function gradeToPoints(grade: Grade | null): number | null {
  if (!grade || grade === 'CP' || grade === 'Completed') {
    return null
  }
  if (grade === 'F') return 0
  return GRADE_POINTS[grade] ?? null
}

// ── Semester detector ─────────────────────────────────────────
const SEM_PATTERNS = [
  /\b([1-4])[\s\-–/]([1-2])\b/,
  /(\d)(?:st|nd|rd|th)\s+year[,\s\-]+(\d)(?:st|nd)\s+sem/i,
  /semester[\s:\-–]+([1-8])/i,
  /\bsem[\s:\-–]+([1-8])\b/i,
]

export function detectSemesterLabel(text: string): string | undefined {
  for (const pat of SEM_PATTERNS) {
    const m = text.match(pat)
    if (m) {
      if (m[1] && m[2]) return `${m[1]}-${m[2]}`
      const n = parseInt(m[1], 10)
      if (!isNaN(n) && n >= 1 && n <= 8) {
        const yr = Math.ceil(n / 2)
        const s = n % 2 === 0 ? 2 : 1
        return `${yr}-${s}`
      }
    }
  }
  return undefined
}

// ── Smart Line Parser (Indian & International Marksheet formats) ───
export function smartParseLine(rawLine: string): ParsedSubject | null {
  let line = rawLine.trim()
  if (line.length < 3) return null

  // Skip headers, metadata, and summary lines
  if (/^(s\.?no|sl\.?no|sub\.?code|subject\s*code|course\s*code|subject\s*name|course\s*name|credits?|grade|marks|total|sgpa|cgpa|result|status|registered|earned|roll|hall\s*ticket|htno|student\s*name|regulation|college\s*code|ccode)\b/i.test(line)) {
    return null
  }
  if (/^(sgpa|cgpa|total\s*credits?|grand\s*total|result\s*:|passed|failed|promoted|overall|controller\s*of\s*examinations)/i.test(line)) {
    return null
  }

  // Replace separators with single space
  line = line.replace(/[|\t;]+/g, ' ').replace(/\s+/g, ' ').trim()

  // Remove leading row counters like "1.", "1 -", "01 ", "1|"
  line = line.replace(/^\d{1,2}[\s.)\-–]+\s*/, '')

  const tokens = line.split(' ')
  if (tokens.length < 2) return null

  // 1. Identify Grade token (searching backwards)
  let gradeIndex = -1
  let gradeValue: Grade | null = null

  // First pass: look for explicit letter grades or CP
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].toUpperCase().replace(/[.,;:()]/g, '')
    // Skip if it's just 'P' or 'PASS' if there might be another letter grade earlier
    if (['PASS', 'PASSED', 'P'].includes(t)) continue
    const matched = normaliseGrade(t)
    if (matched) {
      gradeIndex = i
      gradeValue = matched
      break
    }
  }

  // Second pass: if no grade found, check if last tokens have 'PASS', 'FAIL', or marks (40-100)
  if (!gradeValue) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i].toUpperCase().replace(/[.,;:()]/g, '')
      const matched = normaliseGrade(t)
      if (matched) {
        gradeIndex = i
        gradeValue = matched
        break
      }
    }
  }

  // OCR typo fix: If token is '0' (digit zero) and next token is credits (e.g. '3'), '0' is letter 'O' (Outstanding)
  if (!gradeValue) {
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] === '0' && /^\d(\.(0|5))?$/.test(tokens[i + 1])) {
        gradeIndex = i
        gradeValue = 'S' // O grade -> S
        break
      }
    }
  }

  // 2. Identify Credits token (searching backwards, excluding grade token)
  let creditsIndex = -1
  let creditsValue: number | null = null

  for (let i = tokens.length - 1; i >= 0; i--) {
    if (i === gradeIndex) continue
    const t = tokens[i].replace(/[.,;:()]/g, '')
    const num = parseFloat(t)
    if (!isNaN(num) && num >= 0 && num <= 6 && /^\d(\.(0|5))?$/.test(t)) {
      creditsIndex = i
      creditsValue = num
      break
    }
  }

  // If neither grade nor credits was found, not a valid subject row
  if (!gradeValue && creditsValue === null) {
    return null
  }

  // 3. Strip Subject Code if first token looks like one (e.g. R201101, 19CS301, CS8391, MA101, etc.)
  let startIndex = 0
  if (tokens.length > 2) {
    const firstToken = tokens[0].replace(/[.:,-]$/, '')
    if (
      /^[A-Za-z0-9]{5,10}$/.test(firstToken) ||
      /^[A-Za-z]{2,5}\d{3,5}[A-Za-z]?$/.test(firstToken) ||
      /^\d{2}[A-Za-z]\d{2,5}$/.test(firstToken)
    ) {
      startIndex = 1
    }
  }

  // 4. Extract Subject Name
  const nameTokens: string[] = []
  for (let i = startIndex; i < tokens.length; i++) {
    if (i === gradeIndex || i === creditsIndex) continue
    const t = tokens[i]
    const upper = t.toUpperCase()
    // Skip if it looks like marks (e.g. 25, 75, 100, 40) or grade points
    if (/^\d{1,3}(\.\d+)?$/.test(t) && parseFloat(t) >= 7) continue
    // Skip status words
    if (['PASS', 'FAIL', 'PASSED', 'FAILED', 'REGULAR', 'SUPPLEMENTARY', 'P', 'REM', 'COMP'].includes(upper)) continue
    nameTokens.push(t)
  }

  const subjectName = nameTokens.join(' ').replace(/^[\s\-–:.]+|[\s\-–:.]+$/g, '').trim()
  if (subjectName.length < 2) return null

  // Defaults and safe calculations
  const finalCredits = creditsValue !== null
    ? creditsValue
    : (gradeValue === 'CP' || gradeValue === 'Completed' ? 0 : 3)

  const gp = (gradeValue === 'CP' || gradeValue === 'Completed')
    ? null
    : (gradeValue === 'F' ? 0 : (gradeValue ? gradeToPoints(gradeValue) : null))

  return {
    name: subjectName,
    credits: (gradeValue === 'CP' || gradeValue === 'Completed' || gradeValue === 'F') ? 0 : finalCredits,
    grade: gradeValue,
    grade_points: gp,
  }
}

// ── Smart Raw Text Parser with Multi-Line Merging ────────────
export function parseRawText(text: string): ParseResult {
  const subjects: ParsedSubject[] = []
  const warnings: string[] = []
  const rawLines = text.split(/\r?\n/)

  // Pre-pass: merge lines if a subject name line is split from its grade/credit line
  const mergedLines: string[] = []
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i].trim()
    if (!cur) continue
    const next = (rawLines[i + 1] || '').trim()

    // If next line is short (e.g. "A 3.0" or "S 3" or "COMPLETED 0")
    if (next && /^[A-Za-z0-9+]{1,10}\s+(\d(?:\.\d)?)$/.test(next)) {
      mergedLines.push(cur + ' ' + next)
      i++ // skip next
    } else {
      mergedLines.push(cur)
    }
  }

  for (const line of mergedLines) {
    const parsed = smartParseLine(line)
    if (parsed) {
      const exists = subjects.some(s => s.name.toLowerCase() === parsed.name.toLowerCase())
      if (!exists) {
        subjects.push(parsed)
      }
    }
  }

  const detectedSemester = detectSemesterLabel(text)

  if (subjects.length === 0) {
    warnings.push('No subjects detected. Please verify the format or edit the text directly.')
  }

  return { subjects, detectedSemester, warnings, rawText: text }
}

// ── Excel (.xlsx / .xls) Parser ───────────────────────────────
async function parseExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const warnings: string[] = []
  const subjects: ParsedSubject[] = []
  let detectedSemester: string | undefined

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    const headerText = rows.slice(0, 4).flat().join(' ')
    detectedSemester = detectedSemester ?? detectSemesterLabel(sheetName + ' ' + headerText)

    // Locate header row containing "subject" or "course"
    let headerIdx = -1
    let nameCol = -1, creditsCol = -1, gradeCol = -1, gpCol = -1

    for (let r = 0; r < Math.min(rows.length, 12); r++) {
      const rowStr = rows[r].map((c: any) => String(c).toLowerCase().trim())
      const nameI   = rowStr.findIndex((c: string) => /subject|course|paper|title/i.test(c))
      const crI     = rowStr.findIndex((c: string) => /credit|cr\b/i.test(c))
      const gradeI  = rowStr.findIndex((c: string) => /\bgrade\b|\bgrd\b|\bresult\b/i.test(c))
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
      headerIdx  = 0
      nameCol    = 1
      gradeCol   = 2
      creditsCol = 3
    }

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r]
      const rawName = String(row[nameCol] ?? '').trim()
      if (!rawName || rawName.length < 2) continue
      if (/^(total|sgpa|cgpa|result|pass|fail|grand|status|s\.no|sl\.no)$/i.test(rawName)) continue

      const rawCredits = parseFloat(String(row[creditsCol] ?? ''))
      const rawGrade   = String(row[gradeCol] ?? '').trim()
      const rawGP      = parseFloat(String(row[gpCol] ?? ''))

      const grade   = normaliseGrade(rawGrade)
      const credits = isNaN(rawCredits) ? 3 : Math.min(Math.max(rawCredits, 0), 6)
      const gp      = isNaN(rawGP) ? gradeToPoints(grade) : rawGP

      const isCP = grade === 'CP' || grade === 'Completed'
      const isF  = grade === 'F'

      subjects.push({
        name: rawName,
        credits: (isCP || isF) ? 0 : credits,
        grade,
        grade_points: isCP ? null : (isF ? 0 : (grade ? gradeToPoints(grade) : gp)),
      })
    }
  }

  if (subjects.length === 0) {
    warnings.push('No subject rows found. Please check Excel columns.')
  }

  return { subjects, detectedSemester, warnings }
}

// ── Word (.docx) Parser ───────────────────────────────────────
async function parseWord(file: File): Promise<ParseResult> {
  const mammoth = await import('mammoth')
  const buffer  = await file.arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer })

  const div = document.createElement('div')
  div.innerHTML = html
  const text = div.innerText || div.textContent || ''

  return parseRawText(text)
}

// ── PDF Parser (Digital Text First -> Canvas OCR Fallback) ────
async function parsePDF(file: File, onProgress?: OcrProgressCallback): Promise<ParseResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const buffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: buffer })
    const pdfDoc = await loadingTask.promise

    let fullText = ''
    onProgress?.(30, 'Reading PDF text layer…')

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageStrings = textContent.items.map((item: any) => item.str || '')
      fullText += pageStrings.join(' ') + '\n'
    }

    const digitalResult = parseRawText(fullText)
    if (digitalResult.subjects.length > 0) {
      return digitalResult
    }

    // Scanned PDF fallback
    onProgress?.(50, 'Scanned PDF detected. Running OCR…')
    const firstPage = await pdfDoc.getPage(1)
    const viewport = firstPage.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height

    if (ctx) {
      await firstPage.render({ canvasContext: ctx, viewport }).promise
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
      if (blob) {
        const imageFile = new File([blob], 'page1.png', { type: 'image/png' })
        return parseImageOCR(imageFile, onProgress)
      }
    }

    return digitalResult
  } catch {
    return parseImageOCR(file, onProgress)
  }
}

// ── Image Preprocessing (Canvas Grayscale + Contrast Boost) ──
async function preprocessImage(file: File): Promise<Blob | File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imgData.data

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        const contrast = 1.35
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
        const enhanced = factor * (gray - 128) + 128
        const finalVal = Math.min(255, Math.max(0, enhanced))

        d[i] = finalVal
        d[i + 1] = finalVal
        d[i + 2] = finalVal
      }

      ctx.putImageData(imgData, 0, 0)
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], 'enhanced.png', { type: 'image/png' }) : file)
      }, 'image/png')
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

// ── Image OCR Parser (Tesseract.js) ───────────────────────────
async function parseImageOCR(file: File, onProgress?: OcrProgressCallback): Promise<ParseResult> {
  onProgress?.(10, 'Enhancing image clarity…')
  const processedFile = await preprocessImage(file)

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
    const { data: { text } } = await worker.recognize(processedFile)
    await worker.terminate()

    const result = parseRawText(text)
    if (result.subjects.length === 0) {
      result.warnings.push(
        'OCR completed. If the image was blurry or formatted uniquely, try pasting your result text directly.'
      )
    }
    return result
  } catch (err: any) {
    await worker.terminate()
    throw new Error('OCR failed: ' + (err?.message || 'unknown error'))
  }
}

// ── Main Entry Point ──────────────────────────────────────────
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

  if (ext === 'pdf' || type === 'application/pdf') {
    return parsePDF(file, onProgress)
  }

  if (
    ext === 'png' || ext === 'jpg' || ext === 'jpeg' ||
    ext === 'webp' || ext === 'bmp' || ext === 'tiff' ||
    type.startsWith('image/')
  ) {
    return parseImageOCR(file, onProgress)
  }

  throw new Error(`Unsupported file type: .${ext}. Please upload Excel, Word, PDF, or an image.`)
}
