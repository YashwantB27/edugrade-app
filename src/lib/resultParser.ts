/**
 * resultParser.ts
 * ─────────────────────────────────────────────────────────────
 * Multi-format result parser for Indian universities & colleges:
 *   • Excel (.xlsx / .xls) -> SheetJS structural column parse
 *   • Word  (.docx)        -> mammoth.js HTML text -> smart parse
 *   • PDF   (.pdf)         -> pdfjs-dist digital text extraction
 *                             (with canvas OCR fallback if scanned)
 *   • Image (JPG/PNG/etc)  -> Auto-crop dark borders -> Canvas contrast boost -> Tesseract OCR
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
  'SS': 'S',
  'S.': 'S',
  '$': 'S',
  '$$': 'S',
  '10': 'S',
  '10.0': 'S',

  // A grade / 9 points
  'A+': 'A',
  'A': 'A',
  'A1': 'A',
  'VERY GOOD': 'A',
  '9': 'A',
  '9.0': 'A',

  // B grade / 8 points
  'B+': 'B',
  'B': 'B',
  'BB': 'B',
  'B.': 'B',
  'B1': 'B',
  'GOOD': 'B',
  '8': 'B',
  '8.0': 'B',

  // C grade / 7 points (OCR often misreads 'C' as '©')
  'C+': 'C',
  'C': 'C',
  'CC': 'C',
  'C.': 'C',
  'C-': 'C',
  'C1': 'C',
  'FAIR': 'C',
  'ABOVE AVERAGE': 'C',
  '©': 'C',
  '(C)': 'C',
  'C)': 'C',
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

  // Marks to grade conversion (if a percentage / marks number is passed: e.g. 85, 92)
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

  // 1. Strip Roll Number / Hall Ticket Number AND Subject Code
  let startIndex = 0
  // Check if first token is a Hall Ticket Number (e.g. 24HP5A0221, PAHPSA022], 19A91A0501, etc.)
  if (/^[A-Za-z0-9\]]{9,12}$/.test(tokens[0])) {
    startIndex = 1
  }
  // Check if next token is a Subject Code (e.g. R233101F, R2331021, CS301, 19CS301, etc.)
  if (startIndex < tokens.length && /^[A-Za-z0-9]{5,10}$/.test(tokens[startIndex])) {
    startIndex++
  }

  // 2. Identify Credits token (searching backwards)
  let creditsIndex = -1
  let creditsValue: number | null = null

  // Check last 3 tokens for credits (handles standard 0-6 or OCR misread 15 -> 1.5)
  for (let i = tokens.length - 1; i >= Math.max(startIndex, tokens.length - 3); i--) {
    const t = tokens[i].replace(/[.,;:()]/g, '')
    let num = parseFloat(t)
    // Common OCR typo: '15' instead of '1.5' for lab credits
    if (num === 15) num = 1.5

    if (!isNaN(num) && num >= 0 && num <= 6 && /^\d(\.(0|5))?$/.test(String(num))) {
      creditsIndex = i
      creditsValue = num
      break
    }
  }

  // 3. Identify Grade token (searching backwards, excluding credits token)
  let gradeIndex = -1
  let gradeValue: Grade | null = null

  for (let i = tokens.length - 1; i >= startIndex; i--) {
    if (i === creditsIndex) continue
    const t = tokens[i].toUpperCase().replace(/[.,;:()]/g, '')
    const matched = normaliseGrade(t)
    if (matched) {
      gradeIndex = i
      gradeValue = matched
      break
    }
  }

  // If neither grade nor credits was found, not a valid subject row
  if (!gradeValue && creditsValue === null) {
    return null
  }

  // 4. Extract Subject Name
  const nameTokens: string[] = []
  for (let i = startIndex; i < tokens.length; i++) {
    if (i === gradeIndex || i === creditsIndex) continue
    const t = tokens[i]
    const upper = t.toUpperCase()
    // Skip if it looks like marks (e.g. 26, 22, 24, 30, 28, 20, 0) near the grade/credit
    if (/^\d{1,3}(\.\d+)?$/.test(t) && i >= tokens.length - 4) continue
    // Skip status words
    if (['PASS', 'FAIL', 'PASSED', 'FAILED', 'REGULAR', 'SUPPLEMENTARY', 'P', 'REM', 'COMP'].includes(upper)) continue
    nameTokens.push(t)
  }

  // If grade was not detected as an isolated column, check if the last name token is a grade (e.g. "LAB B" or "LAB Ss")
  if (!gradeValue && nameTokens.length > 1) {
    const lastToken = nameTokens[nameTokens.length - 1]
    const potentialGrade = normaliseGrade(lastToken)
    if (potentialGrade) {
      gradeValue = potentialGrade
      nameTokens.pop()
    }
  }

  let subjectName = nameTokens.join(' ').replace(/^[\s\-–:.]+|[\s\-–:.]+$/g, '').trim()
  if (subjectName.length < 2) return null

  // Defaults and safe calculations
  const isLabOrPractical = /\b(lab|laboratory|workshop|internship|project|seminar|viva|tinkering)\b/i.test(subjectName)
  const inferredCredits = isLabOrPractical ? 1.5 : 3

  const finalCredits = creditsValue !== null
    ? creditsValue
    : (gradeValue === 'CP' || gradeValue === 'Completed' ? 0 : inferredCredits)

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

    // If next line is short (e.g. "A 3.0" or "S 15" or "COMPLETED 0")
    if (next && /^[A-Za-z0-9+©]{1,10}\s+(\d(?:\.\d)?|15)$/.test(next)) {
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

// ── Image Preprocessing (Auto-crop dark borders + Grayscale + Contrast) ──
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

      // Check if image is a screenshot of an image viewer with dark letterboxing borders
      let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0
      let hasDarkBorders = false

      // Quick bounding box scan of light pixels (> 120 brightness)
      for (let y = 0; y < canvas.height; y += 4) {
        for (let x = 0; x < canvas.width; x += 4) {
          const idx = (y * canvas.width + x) * 4
          const brightness = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]
          if (brightness > 120) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }

      // If a bright table exists within dark letterboxing (saving at least 15% wasted borders)
      const tableW = maxX - minX
      const tableH = maxY - minY
      if (tableW > 100 && tableH > 50 && (tableW < canvas.width * 0.85 || tableH < canvas.height * 0.85)) {
        hasDarkBorders = true
      }

      // Create cropped or original canvas
      const targetCanvas = document.createElement('canvas')
      const cropX = hasDarkBorders ? Math.max(0, minX - 10) : 0
      const cropY = hasDarkBorders ? Math.max(0, minY - 10) : 0
      const cropW = hasDarkBorders ? Math.min(canvas.width - cropX, tableW + 20) : canvas.width
      const cropH = hasDarkBorders ? Math.min(canvas.height - cropY, tableH + 20) : canvas.height

      targetCanvas.width = cropW
      targetCanvas.height = cropH
      const targetCtx = targetCanvas.getContext('2d')
      if (!targetCtx) {
        resolve(file)
        return
      }

      // Upscale small marksheets (e.g. mobile screenshots) so text height is optimal for Tesseract OCR
      const scale = cropW < 1200 ? Math.min(2.5, 1600 / cropW) : 1.0
      targetCanvas.width = Math.round(cropW * scale)
      targetCanvas.height = Math.round(cropH * scale)
      const scaledCtx = targetCanvas.getContext('2d')
      if (!scaledCtx) {
        resolve(file)
        return
      }

      scaledCtx.imageSmoothingEnabled = true
      scaledCtx.imageSmoothingQuality = 'high'
      scaledCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, targetCanvas.width, targetCanvas.height)

      const targetImgData = scaledCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height)
      const td = targetImgData.data

      // High-Punch Contrast & Adaptive Binarization for crisp text extraction
      const contrast = 75
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))

      for (let i = 0; i < td.length; i += 4) {
        const gray = 0.299 * td[i] + 0.587 * td[i + 1] + 0.114 * td[i + 2]
        let boosted = factor * (gray - 128) + 128

        // Suppress background paper noise & faint yellow/green highlights to clean white
        if (gray > 165) {
          boosted = Math.min(255, boosted + 35)
        } else if (gray < 110) {
          // Darken text pixels for sharp letter edges
          boosted = Math.max(0, boosted - 25)
        }

        const finalVal = Math.min(255, Math.max(0, Math.round(boosted)))
        td[i] = finalVal
        td[i + 1] = finalVal
        td[i + 2] = finalVal
      }

      scaledCtx.putImageData(targetImgData, 0, 0)
      targetCanvas.toBlob((blob) => {
        resolve(blob ? new File([blob], 'enhanced.png', { type: 'image/png' }) : file)
      }, 'image/png')
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

// ── Image OCR Parser (Tesseract.js) ───────────────────────────
async function parseImageOCR(file: File, onProgress?: OcrProgressCallback): Promise<ParseResult> {
  onProgress?.(10, 'Enhancing image clarity & detecting table…')
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
        'OCR completed. If the image was blurry or formatted uniquely, you can edit or paste the text directly.'
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
