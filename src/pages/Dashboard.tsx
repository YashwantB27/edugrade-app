import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
// @ts-ignore
import html2pdf from 'html2pdf.js'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { calculateCGPA, calculateSGPA, getCGPABadge, calculateRequiredGrade, GRADE_POINTS } from '../lib/grading'
import type { Semester, Subject } from '../lib/grading'

export function Dashboard() {
  const { user } = useAuth()
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedSemester, setSelectedSemester] = useState('')
  const [modalSubjects, setModalSubjects] = useState<Subject[]>([])
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null)
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({})
  const [showSimulator, setShowSimulator] = useState(false)
  const [targetCGPAInput, setTargetCGPAInput] = useState<number>(8.5)
  const [upcomingCreditsInput, setUpcomingCreditsInput] = useState<number>(20)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'DISTINCTION' | 'PASS' | 'CP' | 'BACKLOG'>('ALL')

  useEffect(() => {
    if (user) {
      loadSemesters()
    }
  }, [user])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPrintModal(false)
        setShowModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])


  const loadSemesters = async () => {
    if (!user) return

    try {
      const { data: semData, error: semError } = await supabase
        .from('semesters')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: true })
        .order('semester_number', { ascending: true })

      if (semError) throw semError

      const semestersWithSubjects = await Promise.all(
        (semData || []).map(async (sem) => {
          const { data: subjects, error: subError } = await supabase
            .from('subjects')
            .select('*')
            .eq('semester_id', sem.id)
            .order('name', { ascending: true })

          if (subError) throw subError

          return {
            id: sem.id,
            label: sem.label,
            year: sem.year,
            semester_number: sem.semester_number,
            subjects: subjects || [],
          }
        })
      )

      setSemesters(semestersWithSubjects)
    } catch (error: any) {
      showToast('Error loading semesters: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#ec4899', '#a855f7'],
      })
    } catch {
      // fallback gracefully if canvas is unavailable
    }
  }

  const openModal = () => {
    setEditingSemesterId(null)
    setSelectedSemester('')
    setModalSubjects([
      ...Array(10).fill(null).map((_, i) => ({
        id: `new_${i}`,
        name: '',
        credits: 3,
        grade: null,
        grade_points: null,
      }))
    ])
    setShowModal(true)
  }

  const openEditModal = (semester: Semester) => {
    setEditingSemesterId(semester.id)
    setSelectedSemester(semester.label)
    setModalSubjects(
      semester.subjects.map(s => ({
        id: s.id,
        name: s.name,
        credits: s.credits,
        grade: s.grade,
        grade_points: s.grade_points,
      }))
    )
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSemesterId(null)
    setSelectedSemester('')
    setModalSubjects([])
  }

  const addModalRow = () => {
    setModalSubjects([
      ...modalSubjects,
      {
        id: `new_${Date.now()}`,
        name: '',
        credits: 3,
        grade: null,
        grade_points: null,
      }
    ])
  }

  const addMultipleModalRows = (count: number) => {
    const newRows = Array(count).fill(null).map((_, i) => ({
      id: `new_${Date.now()}_${i}`,
      name: '',
      credits: 3,
      grade: null,
      grade_points: null,
    }))
    setModalSubjects(prev => [...prev, ...newRows])
  }

  const clearEmptyModalRows = () => {
    const filtered = modalSubjects.filter(s => s.name.trim() !== '')
    if (filtered.length === 0) {
      setModalSubjects([{
        id: `new_${Date.now()}`,
        name: '',
        credits: 3,
        grade: null,
        grade_points: null,
      }])
    } else {
      setModalSubjects(filtered)
    }
  }

  const toggleSemesterCollapse = (semesterId: string) => {
    setExpandedSemesters(prev => ({
      ...prev,
      [semesterId]: !prev[semesterId],
    }))
  }

  const allExpanded = semesters.length > 0 && semesters.every(s => !!expandedSemesters[s.id])

  const toggleAllCollapse = () => {
    if (allExpanded) {
      setExpandedSemesters({})
    } else {
      const next: Record<string, boolean> = {}
      semesters.forEach(s => { next[s.id] = true })
      setExpandedSemesters(next)
    }
  }

  const exportTranscriptCSV = () => {
    if (semesters.length === 0) {
      showToast('No semesters to export')
      return
    }

    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Semester,Subject Name,Credits,Grade,Grade Points\r\n'

    semesters.forEach(sem => {
      sem.subjects.forEach(sub => {
        const credits = sub.grade === 'CP' || sub.grade === 'Completed' ? '--' : sub.credits
        const grade = sub.grade || '--'
        const gradePts = sub.grade === 'CP' || sub.grade === 'Completed' ? '--' : (sub.grade_points ?? '--')
        csvContent += `"${sem.label}","${sub.name.replace(/"/g, '""')}","${credits}","${grade}","${gradePts}"\r\n`
      })
      const semSgpa = calculateSGPA(sem.subjects)
      csvContent += `"${sem.label} (SGPA: ${semSgpa > 0 ? semSgpa.toFixed(2) : '--'})",,,,\r\n`
    })

    const currentCgpa = calculateCGPA(semesters)
    csvContent += `\r\n"Cumulative CGPA: ${currentCgpa > 0 ? currentCgpa.toFixed(2) : '--'}",,,,\r\n`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `EduGrade_Transcript_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('📄 Transcript exported as CSV!')
  }

  const downloadTranscriptPDF = async () => {
    const transcriptEl = document.getElementById('printable-transcript-document')
    if (!transcriptEl) return

    setIsGeneratingPDF(true)
    try {
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `EduGrade_Transcript_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }
      await html2pdf().set(opt).from(transcriptEl).save()
      showToast('📥 PDF downloaded successfully!')
      setShowPrintModal(false)
    } catch (err) {
      showToast('Error generating PDF. Please try again.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const updateModalSubject = (index: number, field: keyof Subject, value: any) => {
    const updated = [...modalSubjects]
    updated[index] = { ...updated[index], [field]: value }

    if (field === 'grade') {
      if (value === 'CP' || value === 'Completed') {
        updated[index].credits = 0
        updated[index].grade_points = null
      } else if (value === 'F') {
        updated[index].credits = 0
        updated[index].grade_points = 0
      } else {
        if (updated[index].credits === 0) {
          updated[index].credits = 3
        }
        const gradePoints = value ? GRADE_POINTS[value] ?? null : null
        updated[index].grade_points = gradePoints
      }
    } else if (field === 'grade_points') {
      if (value !== null) {
        const matchedGrade = Object.entries(GRADE_POINTS).find(([_, pts]) => pts === value)?.[0]
        if (matchedGrade && !updated[index].grade) {
          updated[index].grade = matchedGrade
        }
      }
    }

    setModalSubjects(updated)
  }

  const deleteModalRow = (index: number) => {
    setModalSubjects(modalSubjects.filter((_, i) => i !== index))
  }

  const handleSemesterSelectChange = (newVal: string) => {
    setSelectedSemester(newVal)
    if (!newVal) {
      setEditingSemesterId(null)
      return
    }

    const [y, s] = newVal.split('-').map(Number)
    const existing = semesters.find(
      sem => (sem.year === y && sem.semester_number === s) || sem.label === newVal
    )

    if (existing) {
      setEditingSemesterId(existing.id)
      const hasTypedAnySubject = modalSubjects.some(sub => sub.name.trim() !== '')
      if (!hasTypedAnySubject && existing.subjects && existing.subjects.length > 0) {
        setModalSubjects(
          existing.subjects.map(sub => ({
            id: sub.id,
            name: sub.name,
            credits: sub.credits,
            grade: sub.grade,
            grade_points: sub.grade_points,
          }))
        )
        showToast(`Loaded existing subjects for Semester ${existing.label}`)
      }
    } else {
      if (!editingSemesterId || semesters.some(sem => sem.id === editingSemesterId && sem.label !== newVal)) {
        setEditingSemesterId(null)
      }
    }
  }

  const saveSemester = async () => {
    if (!user || !selectedSemester) {
      showToast('Please select a semester')
      return
    }

    const validSubjects = modalSubjects.filter(s => s.name.trim() !== '')

    if (validSubjects.length === 0) {
      showToast('Please add at least one subject')
      return
    }

    try {
      const [year, semNum] = selectedSemester.split('-').map(Number)

      // Resolve existing semester id if already present in state or Supabase
      let targetSemesterId = editingSemesterId

      if (!targetSemesterId) {
        const localExisting = semesters.find(
          s => (s.year === year && s.semester_number === semNum) || s.label === selectedSemester
        )
        if (localExisting) {
          targetSemesterId = localExisting.id
        } else {
          const { data: dbExisting } = await supabase
            .from('semesters')
            .select('id')
            .eq('user_id', user.id)
            .eq('year', year)
            .eq('semester_number', semNum)
            .maybeSingle()

          if (dbExisting) {
            targetSemesterId = dbExisting.id
          }
        }
      }

      // If still no semester found, create new one with fallback for race conditions
      if (!targetSemesterId) {
        const { data: semData, error: semError } = await supabase
          .from('semesters')
          .insert({
            user_id: user.id,
            label: selectedSemester,
            year,
            semester_number: semNum,
          })
          .select('id')
          .maybeSingle()

        if (semError) {
          // If a duplicate key violation occurs, retrieve the conflicting semester id
          const { data: fallbackDb } = await supabase
            .from('semesters')
            .select('id')
            .eq('user_id', user.id)
            .eq('year', year)
            .eq('semester_number', semNum)
            .maybeSingle()

          if (fallbackDb) {
            targetSemesterId = fallbackDb.id
          } else {
            throw semError
          }
        } else if (semData) {
          targetSemesterId = semData.id
        }
      }

      if (!targetSemesterId) {
        throw new Error('Unable to initialize semester record')
      }

      // Update semester info
      const { error: updSemErr } = await supabase
        .from('semesters')
        .update({
          label: selectedSemester,
          year,
          semester_number: semNum,
        })
        .eq('id', targetSemesterId)

      if (updSemErr) throw updSemErr

      // Manage and sync subjects for targetSemesterId
      const { data: currentDbSubs, error: subFetchErr } = await supabase
        .from('subjects')
        .select('id')
        .eq('semester_id', targetSemesterId)

      if (subFetchErr) throw subFetchErr

      const originalSubjectIds = (currentDbSubs || []).map(s => s.id)
      const currentExistingIds = validSubjects
        .filter(s => !s.id.startsWith('new_'))
        .map(s => s.id)

      // Delete removed subjects
      const idsToDelete = originalSubjectIds.filter(id => !currentExistingIds.includes(id))
      if (idsToDelete.length > 0) {
        const { error: delError } = await supabase
          .from('subjects')
          .delete()
          .in('id', idsToDelete)

        if (delError) throw delError
      }

      // Update existing subjects
      const existingToUpdate = validSubjects.filter(s => !s.id.startsWith('new_'))
      for (const s of existingToUpdate) {
        const isCP = s.grade === 'CP' || s.grade === 'Completed'
        const isF = s.grade === 'F'
        const safeGrade = isCP ? 'Completed' : s.grade
        const safeGradePoints = isCP ? null : (isF ? 0 : s.grade_points)
        const safeCredits = (isCP || isF) ? 0 : s.credits

        const { error: updError } = await supabase
          .from('subjects')
          .update({
            name: s.name.trim(),
            credits: safeCredits,
            grade: safeGrade,
            grade_points: safeGradePoints,
          })
          .eq('id', s.id)

        if (updError) throw updError
      }

      // Insert new subjects
      const newToInsert = validSubjects.filter(s => s.id.startsWith('new_'))
      if (newToInsert.length > 0) {
        const { error: insError } = await supabase
          .from('subjects')
          .insert(
            newToInsert.map(s => {
              const isCP = s.grade === 'CP' || s.grade === 'Completed'
              const isF = s.grade === 'F'
              return {
                semester_id: targetSemesterId,
                user_id: user.id,
                name: s.name.trim(),
                credits: (isCP || isF) ? 0 : s.credits,
                grade: isCP ? 'Completed' : s.grade,
                grade_points: isCP ? null : (isF ? 0 : s.grade_points),
              }
            })
          )

        if (insError) throw insError
      }

      showToast('✅ Semester saved successfully!')
      if (modalSGPA >= 8.5) {
        triggerCelebration()
      }

      closeModal()
      loadSemesters()
    } catch (error: any) {
      showToast('Error saving semester: ' + error.message)
    }
  }

  const deleteSemester = async (semesterId: string) => {
    if (!confirm('Delete this semester and all its subjects?')) return

    try {
      const { error } = await supabase
        .from('semesters')
        .delete()
        .eq('id', semesterId)

      if (error) throw error

      showToast('🗑️ Semester deleted')
      loadSemesters()
    } catch (error: any) {
      showToast('Error deleting semester: ' + error.message)
    }
  }

  const cgpa = calculateCGPA(semesters)
  const badge = getCGPABadge(cgpa)
  const totalCredits = semesters.reduce((sum, sem) =>
    sum + sem.subjects.reduce((s, sub) =>
      sub.grade === 'CP' || sub.grade === 'Completed' ? s : s + sub.credits, 0
    ), 0
  )
  const totalSubjects = semesters.reduce((sum, sem) => sum + sem.subjects.length, 0)
  const modalSGPA = calculateSGPA(modalSubjects)

  // Trend data & chart calculations
  const trendData = semesters.map(sem => {
    const sgpa = calculateSGPA(sem.subjects)
    const credits = sem.subjects.reduce((sum, sub) =>
      sub.grade === 'CP' || sub.grade === 'Completed' ? sum : sum + sub.credits, 0
    )
    return {
      label: sem.label,
      sgpa,
      credits,
    }
  })

  // Circular gauge parameters
  const gaugeRadius = 44
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const gaugePercentage = Math.min(Math.max(cgpa / 10, 0), 1)
  const gaugeOffset = gaugeCircumference * (1 - gaugePercentage)

  // Chart coordinates
  const chartWidth = 220
  const chartHeight = 84
  const padX = 18
  const padTop = 14
  const padBottom = 20
  const chartPlotWidth = chartWidth - padX * 2
  const chartPlotHeight = chartHeight - padTop - padBottom

  const trendPoints = trendData.map((d, i) => {
    const x = trendData.length === 1
      ? chartWidth / 2
      : padX + (i * chartPlotWidth) / (trendData.length - 1)
    const normalized = Math.min(Math.max(d.sgpa / 10, 0), 1)
    const y = padTop + (1 - normalized) * chartPlotHeight
    return { ...d, x, y }
  })

  const linePath = trendPoints.length > 0
    ? trendPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : ''

  const areaPath = trendPoints.length > 0
    ? `${linePath} L ${trendPoints[trendPoints.length - 1].x.toFixed(1)} ${(chartHeight - padBottom).toFixed(1)} L ${trendPoints[0].x.toFixed(1)} ${(chartHeight - padBottom).toFixed(1)} Z`
    : ''

  // Grade distribution and performance analytics computations
  const allSubjects = semesters.flatMap(s => s.subjects)
  const gradeDistribution: Record<string, number> = {
    'S': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0, 'CP': 0, 'F': 0,
  }
  let totalGradedSubjects = 0
  let totalCPSubjects = 0
  let totalBacklogs = 0

  allSubjects.forEach(s => {
    if (s.grade === 'CP' || s.grade === 'Completed') {
      gradeDistribution['CP']++
      totalCPSubjects++
    } else if (s.grade === 'F') {
      gradeDistribution['F']++
      totalBacklogs++
      totalGradedSubjects++
    } else if (s.grade && gradeDistribution[s.grade] !== undefined) {
      gradeDistribution[s.grade]++
      totalGradedSubjects++
    }
  })

  const gradedSemesters = semesters
    .map(s => ({ label: s.label, sgpa: calculateSGPA(s.subjects) }))
    .filter(s => s.sgpa > 0)

  const highestSemester = gradedSemesters.length > 0
    ? gradedSemesters.reduce((max, s) => s.sgpa > max.sgpa ? s : max, gradedSemesters[0])
    : null

  const lowestSemester = gradedSemesters.length > 0
    ? gradedSemesters.reduce((min, s) => s.sgpa < min.sgpa ? s : min, gradedSemesters[0])
    : null

  // Search & Filter helper
  const matchesSearchAndFilter = (subject: Subject) => {
    const q = searchQuery.trim().toLowerCase()
    const matchesQuery = !q || subject.name.toLowerCase().includes(q)
    if (!matchesQuery) return false

    if (gradeFilter === 'DISTINCTION') return subject.grade === 'S' || subject.grade === 'A'
    if (gradeFilter === 'PASS') return subject.grade === 'B' || subject.grade === 'C' || subject.grade === 'D' || subject.grade === 'E'
    if (gradeFilter === 'CP') return subject.grade === 'CP' || subject.grade === 'Completed'
    if (gradeFilter === 'BACKLOG') return subject.grade === 'F'
    return true
  }

  const isFilterActive = searchQuery.trim() !== '' || gradeFilter !== 'ALL'

  // Total matching subjects across all semesters
  const totalMatchingSubjects = semesters.reduce((sum, sem) =>
    sum + sem.subjects.filter(matchesSearchAndFilter).length, 0
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[rgb(var(--bg-primary))]">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
          {/* Skeleton Hero Banner */}
          <div className="h-64 rounded-3xl bg-[rgb(var(--bg-secondary))] border border-[rgb(var(--border))] mb-8 flex flex-col sm:flex-row items-center justify-between p-8 gap-6">
            <div className="space-y-4 w-full sm:w-auto">
              <div className="h-4 w-32 bg-[rgb(var(--bg-tertiary))] rounded-md" />
              <div className="h-10 w-48 bg-[rgb(var(--bg-tertiary))] rounded-lg" />
              <div className="h-4 w-64 bg-[rgb(var(--bg-tertiary))] rounded-md" />
            </div>
            <div className="w-28 h-28 rounded-full bg-[rgb(var(--bg-tertiary))] shrink-0" />
          </div>

          {/* Skeleton Action Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 w-44 bg-[rgb(var(--bg-secondary))] rounded-lg" />
            <div className="h-10 w-36 bg-[rgb(var(--bg-secondary))] rounded-lg" />
          </div>

          {/* Skeleton Semester Cards */}
          <div className="space-y-5">
            {[1, 2].map(n => (
              <div key={n} className="card space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-6 w-36 bg-[rgb(var(--bg-tertiary))] rounded-md" />
                  <div className="h-8 w-20 bg-[rgb(var(--bg-tertiary))] rounded-md" />
                </div>
                <div className="space-y-2">
                  <div className="h-8 w-full bg-[rgb(var(--bg-tertiary))] rounded-md" />
                  <div className="h-8 w-full bg-[rgb(var(--bg-tertiary))] rounded-md" />
                  <div className="h-8 w-full bg-[rgb(var(--bg-tertiary))] rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-primary))]">
      <div className="no-print">
        <Navbar />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* CGPA Hero Card with Glassmorphism & Micro-Gradients */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 rounded-3xl p-6 sm:p-8 mb-8 text-white shadow-xl shadow-primary-950/20 border border-white/10 no-print">
          {/* Ambient glowing orbs */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left side: Circular Animated Gauge & Score Info */}
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left w-full lg:w-auto">
              {/* Radial Progress Ring */}
              <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 108 108">
                  <defs>
                    <linearGradient id="cgpaRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>
                  {/* Track circle */}
                  <circle
                    cx="54"
                    cy="54"
                    r={gaugeRadius}
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="54"
                    cy="54"
                    r={gaugeRadius}
                    stroke="url(#cgpaRingGradient)"
                    strokeWidth="8"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeOffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                {/* Center score display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-display tracking-tight leading-none text-white drop-shadow-sm">
                    {cgpa > 0 ? cgpa.toFixed(2) : '—'}
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-primary-200 mt-0.5 tracking-wider">
                    CGPA
                  </span>
                </div>
              </div>

              {/* Title & Badge */}
              <div>
                <p className="text-primary-200 text-xs font-semibold tracking-wider uppercase mb-1">
                  Cumulative Academic Performance
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-bold font-display text-white">
                    {cgpa > 0 ? `${cgpa.toFixed(2)} CGPA` : 'No Grades Yet'}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                  {cgpa > 0 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md border border-white/20 text-white shadow-xs">
                      ✨ {badge.label}
                    </span>
                  )}
                  <span className="text-xs text-primary-200/90 font-medium">
                    Scale: 10.0
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-primary-100/80 max-w-sm">
                  {cgpa >= 9
                    ? 'Exceptional academic standing! First class with distinction.'
                    : cgpa >= 7.5
                    ? 'Strong and steady performance across completed semesters.'
                    : cgpa > 0
                    ? 'Keep pushing for higher grades in upcoming semesters.'
                    : 'Click "Add Semester" to record your subjects and track your SGPA.'}
                </p>
              </div>
            </div>

            {/* Right side: Frosted Glass Stats & Interactive SGPA Progression Chart */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto justify-end">
              {/* Stat Tiles in Frosted Glass */}
              <div className="grid grid-cols-3 sm:grid-cols-1 gap-2 w-full sm:w-auto shrink-0">
                <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/15 shadow-xs flex items-center justify-between gap-4">
                  <div className="text-xs text-primary-200">Semesters</div>
                  <div className="text-base font-bold text-white">{semesters.length}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/15 shadow-xs flex items-center justify-between gap-4">
                  <div className="text-xs text-primary-200">Total Credits</div>
                  <div className="text-base font-bold text-white">{totalCredits}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/15 shadow-xs flex items-center justify-between gap-4">
                  <div className="text-xs text-primary-200">Subjects</div>
                  <div className="text-base font-bold text-white">{totalSubjects}</div>
                </div>
              </div>

              {/* Interactive Trend Chart */}
              {trendData.length > 0 && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 w-full sm:w-64 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-primary-200">SGPA Trend</span>
                    {hoveredTrendIdx !== null ? (
                      <span className="text-xs font-bold text-cyan-300">
                        {trendData[hoveredTrendIdx].label}: {trendData[hoveredTrendIdx].sgpa > 0 ? trendData[hoveredTrendIdx].sgpa.toFixed(2) : '—'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-primary-300/80">Interactive</span>
                    )}
                  </div>

                  <div className="relative">
                    <svg className="w-full h-20" viewBox={`0 0 ${chartWidth} ${chartHeight}`} fill="none">
                      <defs>
                        <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid dashed baseline */}
                      <line
                        x1={padX}
                        y1={chartHeight - padBottom}
                        x2={chartWidth - padX}
                        y2={chartHeight - padBottom}
                        stroke="rgba(255,255,255,0.2)"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />

                      {/* Area gradient under line */}
                      {areaPath && (
                        <path d={areaPath} fill="url(#trendAreaGradient)" />
                      )}

                      {/* Main trend line */}
                      {linePath && (
                        <path
                          d={linePath}
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Interactive circles and label text */}
                      {trendPoints.map((p, i) => (
                        <g key={p.label}>
                          {/* Outer glow ring for hovered point */}
                          {hoveredTrendIdx === i && (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="8"
                              fill="rgba(56, 189, 248, 0.3)"
                              className="animate-pulse"
                            />
                          )}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredTrendIdx === i ? 5 : 3.5}
                            fill="#ffffff"
                            stroke="#38bdf8"
                            strokeWidth={hoveredTrendIdx === i ? 3 : 2}
                            className="cursor-pointer transition-all duration-200"
                            onMouseEnter={() => setHoveredTrendIdx(i)}
                            onMouseLeave={() => setHoveredTrendIdx(null)}
                          />
                          <text
                            x={p.x}
                            y={chartHeight - 4}
                            textAnchor="middle"
                            className="text-[9px] fill-primary-200 font-medium select-none pointer-events-none"
                          >
                            {p.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Academic Tools: Target CGPA Simulator, Analytics, Transcript & Export */}
        <div className="card mb-8 border border-primary-500/20 bg-gradient-to-r from-primary-500/5 via-[rgb(var(--bg-secondary))] to-indigo-500/5 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xl shrink-0">
                🎯
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-[rgb(var(--text-primary))]">
                  Academic Tools & Performance Suite
                </h3>
                <p className="text-xs text-[rgb(var(--text-secondary))]">
                  Simulate future targets, analyze grade distribution, and print transcripts
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                onClick={() => setShowAnalytics(prev => !prev)}
                className={`text-xs sm:text-sm py-2 px-3 rounded-lg font-medium transition-colors ${
                  showAnalytics
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'btn-secondary'
                }`}
                title="View letter grade distribution and analytics"
              >
                📊 {showAnalytics ? 'Hide Analytics' : 'Grade Analytics'}
              </button>
              <button
                onClick={() => setShowPrintModal(true)}
                className="btn-secondary text-xs sm:text-sm py-2 px-3"
                title="Preview and print official grade report card"
              >
                🖨️ Print Transcript
              </button>
              <button
                onClick={exportTranscriptCSV}
                className="btn-secondary text-xs sm:text-sm py-2 px-3"
                title="Download CSV summary of all courses"
              >
                📥 Export CSV
              </button>
              <button
                onClick={() => setShowSimulator(prev => !prev)}
                className={`text-xs sm:text-sm py-2 px-3.5 rounded-lg font-medium transition-colors ${
                  showSimulator
                    ? 'bg-primary-700 text-white shadow-xs'
                    : 'btn-primary'
                }`}
              >
                {showSimulator ? 'Close Simulator' : '🎯 Target Simulator'}
              </button>
            </div>
          </div>

          {/* Grade Analytics & Distribution Panel */}
          {showAnalytics && (
            <div className="mt-6 pt-6 border-t border-[rgb(var(--border))] transition-all duration-300">
              <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold font-display text-[rgb(var(--text-primary))]">
                    Performance Breakdown & Letter Grade Distribution
                  </h4>
                  <p className="text-xs text-[rgb(var(--text-secondary))]">
                    Aggregated across all {semesters.length} recorded semester{semesters.length === 1 ? '' : 's'} ({totalSubjects} total courses)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 dark:bg-primary-950/60 dark:text-primary-300 font-semibold">
                    {totalGradedSubjects} Graded Courses
                  </span>
                  {totalCPSubjects > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-semibold">
                      {totalCPSubjects} Audit / CP Courses
                    </span>
                  )}
                </div>
              </div>

              {/* Milestones / Highlight tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))]">
                  <span className="text-[10px] uppercase font-semibold text-[rgb(var(--text-secondary))] block">
                    Highest SGPA
                  </span>
                  <span className="text-lg font-extrabold font-display text-emerald-600 dark:text-emerald-400">
                    {highestSemester ? `${highestSemester.sgpa.toFixed(2)}` : '—'}
                  </span>
                  <span className="text-[11px] text-[rgb(var(--text-secondary))] block truncate">
                    {highestSemester ? `Semester ${highestSemester.label}` : 'No semesters'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))]">
                  <span className="text-[10px] uppercase font-semibold text-[rgb(var(--text-secondary))] block">
                    Lowest SGPA
                  </span>
                  <span className="text-lg font-extrabold font-display text-blue-600 dark:text-blue-400">
                    {lowestSemester ? `${lowestSemester.sgpa.toFixed(2)}` : '—'}
                  </span>
                  <span className="text-[11px] text-[rgb(var(--text-secondary))] block truncate">
                    {lowestSemester ? `Semester ${lowestSemester.label}` : 'No semesters'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))]">
                  <span className="text-[10px] uppercase font-semibold text-[rgb(var(--text-secondary))] block">
                    Academic Standing
                  </span>
                  <span className="text-lg font-extrabold font-display text-primary-600 dark:text-primary-400">
                    {badge.label}
                  </span>
                  <span className="text-[11px] text-[rgb(var(--text-secondary))] block">
                    CGPA {cgpa > 0 ? cgpa.toFixed(2) : '0.00'} / 10.0
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))]">
                  <span className="text-[10px] uppercase font-semibold text-[rgb(var(--text-secondary))] block">
                    Backlog Record
                  </span>
                  <span className={`text-lg font-extrabold font-display ${totalBacklogs === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {totalBacklogs === 0 ? '0 Backlogs ✨' : `${totalBacklogs} Active ⚠️`}
                  </span>
                  <span className="text-[11px] text-[rgb(var(--text-secondary))] block">
                    {totalBacklogs === 0 ? 'Clear Academic Standing' : 'Requires Clearance'}
                  </span>
                </div>
              </div>

              {/* Grade distribution horizontal bars */}
              <div className="space-y-2.5 bg-[rgb(var(--bg-primary))] p-4 rounded-xl border border-[rgb(var(--border))]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] block mb-3">
                  Letter Grade Frequencies
                </span>
                {[
                  { grade: 'S', pts: 10, color: 'bg-emerald-500', bgText: 'text-emerald-700 dark:text-emerald-300' },
                  { grade: 'A', pts: 9, color: 'bg-emerald-400', bgText: 'text-emerald-600 dark:text-emerald-400' },
                  { grade: 'B', pts: 8, color: 'bg-blue-500', bgText: 'text-blue-700 dark:text-blue-300' },
                  { grade: 'C', pts: 7, color: 'bg-blue-400', bgText: 'text-blue-600 dark:text-blue-400' },
                  { grade: 'D', pts: 6, color: 'bg-amber-500', bgText: 'text-amber-700 dark:text-amber-300' },
                  { grade: 'E', pts: 5, color: 'bg-amber-400', bgText: 'text-amber-600 dark:text-amber-400' },
                  { grade: 'CP', pts: null, color: 'bg-purple-500', bgText: 'text-purple-700 dark:text-purple-300' },
                  { grade: 'F', pts: 0, color: 'bg-rose-500', bgText: 'text-rose-700 dark:text-rose-300' },
                ].map(item => {
                  const count = gradeDistribution[item.grade] || 0
                  const pct = totalSubjects > 0 ? (count / totalSubjects) * 100 : 0
                  return (
                    <div key={item.grade} className="flex items-center gap-3 text-xs">
                      <div className="w-14 font-bold flex items-center justify-between shrink-0">
                        <span className={item.bgText}>{item.grade}</span>
                        <span className="text-[10px] text-[rgb(var(--text-secondary))] font-normal">
                          {item.pts !== null ? `(${item.pts})` : '(--)'}
                        </span>
                      </div>
                      <div className="flex-1 bg-[rgb(var(--bg-tertiary))] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-16 text-right font-medium text-[rgb(var(--text-secondary))] shrink-0">
                        {count} <span className="text-[10px] opacity-75">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {showSimulator && (
            <div className="mt-6 pt-6 border-t border-[rgb(var(--border))] transition-all duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Control 1: Target CGPA */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-2">
                    Target CGPA (Scale: 10.0)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={Math.max(1, Math.floor(cgpa))}
                      max="10"
                      step="0.05"
                      value={targetCGPAInput}
                      onChange={(e) => setTargetCGPAInput(parseFloat(e.target.value))}
                      className="w-full accent-primary-600 cursor-pointer"
                    />
                    <span className="font-display font-bold text-lg text-primary-600 dark:text-primary-400 w-14 text-right">
                      {targetCGPAInput.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[rgb(var(--text-secondary))] mt-1">
                    <span>Current: {cgpa > 0 ? cgpa.toFixed(2) : '0.00'}</span>
                    <span>Max: 10.00</span>
                  </div>
                </div>

                {/* Control 2: Planned Upcoming Credits */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-2">
                    Upcoming Credits Evaluated
                  </label>
                  <div className="flex items-center gap-2">
                    {[15, 20, 24].map(cr => (
                      <button
                        key={cr}
                        type="button"
                        onClick={() => setUpcomingCreditsInput(cr)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          upcomingCreditsInput === cr
                            ? 'bg-primary-600 text-white shadow-xs'
                            : 'bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
                        }`}
                      >
                        {cr} cr
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={upcomingCreditsInput}
                      onChange={(e) => setUpcomingCreditsInput(Math.max(1, parseFloat(e.target.value) || 1))}
                      className="input-field text-sm py-1 w-20 text-center font-semibold ml-2"
                    />
                  </div>
                  <p className="text-[10px] text-[rgb(var(--text-secondary))] mt-1">
                    Completed Credits: {totalCredits}
                  </p>
                </div>

                {/* Live Simulation Output Card */}
                {(() => {
                  const requiredSGPA = calculateRequiredGrade(cgpa, totalCredits, targetCGPAInput, upcomingCreditsInput)
                  const isAttainable = requiredSGPA <= 10 && requiredSGPA >= 0
                  const isAlreadyAchieved = targetCGPAInput <= cgpa

                  return (
                    <div className="p-4 rounded-xl bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))] shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[rgb(var(--text-secondary))]">
                          Required Upcoming SGPA
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isAlreadyAchieved
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : isAttainable
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}>
                          {isAlreadyAchieved ? 'Achieved' : isAttainable ? 'Realistic Goal' : 'Needs More Credits'}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-3xl font-extrabold font-display text-[rgb(var(--text-primary))]">
                          {isAlreadyAchieved ? '≥ ' + Math.max(0, requiredSGPA).toFixed(2) : requiredSGPA.toFixed(2)}
                        </span>
                        <span className="text-xs text-[rgb(var(--text-secondary))]">/ 10.0 SGPA</span>
                      </div>

                      <p className="text-[11px] text-[rgb(var(--text-secondary))] leading-tight">
                        {isAlreadyAchieved
                          ? `You already have ${cgpa.toFixed(2)} CGPA! Maintaining ≥ ${Math.max(0, requiredSGPA).toFixed(2)} keeps this standing.`
                          : isAttainable
                          ? `Score an average of ${requiredSGPA.toFixed(2)} across next ${upcomingCreditsInput} credits to hit ${targetCGPAInput.toFixed(2)} CGPA.`
                          : `Requires ${requiredSGPA.toFixed(2)} (>10.0). Take additional credits to make this target reachable.`}
                      </p>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Search & Grade Filter Bar */}
        {semesters.length > 0 && (
          <div className="card mb-6 py-3.5 px-4 bg-[rgb(var(--bg-secondary))] border border-[rgb(var(--border))] no-print">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search courses across all semesters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-9 pr-8 text-xs sm:text-sm py-1.5 w-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[rgb(var(--text-secondary))] font-medium mr-1 hidden sm:inline">
                  Filter:
                </span>
                {[
                  { id: 'ALL', label: 'All Grades' },
                  { id: 'DISTINCTION', label: 'Distinction (S, A)' },
                  { id: 'PASS', label: 'Passing (B–E)' },
                  { id: 'CP', label: 'Completed (CP)' },
                  { id: 'BACKLOG', label: 'Backlogs (F)' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setGradeFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      gradeFilter === tab.id
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}

                {isFilterActive && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setGradeFilter('ALL')
                    }}
                    className="text-xs text-rose-500 hover:text-rose-600 font-medium ml-1 underline decoration-dotted"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Filter Active Summary */}
            {isFilterActive && (
              <div className="mt-2.5 pt-2 border-t border-[rgb(var(--border))] flex items-center justify-between text-xs text-[rgb(var(--text-secondary))]">
                <span>
                  Showing <strong className="text-[rgb(var(--text-primary))]">{totalMatchingSubjects}</strong> matching course{totalMatchingSubjects === 1 ? '' : 's'} across semesters
                </span>
                <span className="text-[11px] italic">
                  Non-matching courses in each semester are filtered out
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 no-print">
          <div>
            <h2 className="text-2xl font-display font-semibold text-[rgb(var(--text-primary))]">My Semesters</h2>
            <p className="text-xs text-[rgb(var(--text-secondary))] mt-0.5">Click any semester header to expand or collapse details</p>
          </div>
          <div className="flex items-center gap-3">
            {semesters.length > 1 && (
              <button
                onClick={toggleAllCollapse}
                className="btn-secondary text-xs sm:text-sm py-2 px-3.5"
                title={allExpanded ? "Collapse all semester tables" : "Expand all semester tables"}
              >
                {allExpanded ? "▲ Collapse All" : "▼ Expand All"}
              </button>
            )}
            <button onClick={openModal} className="btn-primary text-xs sm:text-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z"/>
              </svg>
              Add Semester
            </button>
          </div>
        </div>

        {/* Semesters Grid */}
        {semesters.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-6xl mb-4">🎓</div>
            <p className="text-xl font-semibold mb-2">No semesters yet</p>
            <p className="text-[rgb(var(--text-secondary))]">Click "Add Semester" to start tracking your grades.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {semesters.map(semester => {
              const sgpa = calculateSGPA(semester.subjects)
              const semCredits = semester.subjects.reduce((sum, s) =>
                s.grade === 'CP' || s.grade === 'Completed' ? sum : sum + s.credits, 0
              )
              const displayedSubjects = isFilterActive
                ? semester.subjects.filter(matchesSearchAndFilter)
                : semester.subjects
              const isCollapsed = isFilterActive ? false : !expandedSemesters[semester.id]

              if (isFilterActive && displayedSubjects.length === 0) {
                return (
                  <div
                    key={semester.id}
                    className="card py-3 px-4 opacity-60 bg-[rgb(var(--bg-secondary))]/50 border border-dashed border-[rgb(var(--border))]"
                  >
                    <div className="flex items-center justify-between text-xs text-[rgb(var(--text-secondary))]">
                      <span>Semester {semester.label} ({semester.subjects.length} courses)</span>
                      <span>No courses match current filter</span>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={semester.id}
                  className="card hover:shadow-lg hover:border-primary-500/30 transition-all duration-300 group overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
                    <div
                      onClick={() => toggleSemesterCollapse(semester.id)}
                      className="flex flex-wrap items-center gap-2.5 cursor-pointer flex-1"
                    >
                      <button
                        type="button"
                        aria-label={isCollapsed ? `Expand Semester ${semester.label}` : `Collapse Semester ${semester.label}`}
                        className="p-1 rounded-md hover:bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-secondary))] transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <h3 className="text-lg font-bold font-display text-[rgb(var(--text-primary))] group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        Semester {semester.label}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        sgpa >= 9
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border dark:border-emerald-800/40'
                          : sgpa >= 8
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:border dark:border-blue-800/40'
                          : sgpa >= 7
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border dark:border-indigo-800/40'
                          : sgpa > 0
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border dark:border-yellow-800/40'
                          : semester.subjects.length > 0
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border dark:border-yellow-800/40'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        SGPA: {semester.subjects.filter(s => s.grade && s.grade !== 'CP' && s.grade !== 'Completed' && s.grade !== 'F' && s.grade_points !== null).length > 0
                          ? sgpa.toFixed(2)
                          : '—'}
                      </span>
                      <span className="text-xs text-[rgb(var(--text-secondary))] font-medium">
                        • {semCredits} Credits
                      </span>
                      <span className="text-xs text-[rgb(var(--text-secondary))] font-medium">
                        • {semester.subjects.length} Subjects
                      </span>
                      {isFilterActive && (
                        <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-md">
                          {displayedSubjects.length} of {semester.subjects.length} matched
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => openEditModal(semester)}
                        className="p-2 rounded-lg text-[rgb(var(--text-secondary))] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 transition-colors"
                        title="Edit Semester"
                        aria-label={`Edit ${semester.label}`}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteSemester(semester.id)}
                        className="p-2 rounded-lg text-[rgb(var(--text-secondary))] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                        title="Delete Semester"
                        aria-label={`Delete ${semester.label}`}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="overflow-x-auto mt-4 pt-3 border-t border-[rgb(var(--border))] transition-all duration-300">
                      <table className="w-full text-sm">
                        <thead className="border-b border-[rgb(var(--border))]">
                          <tr className="text-left text-[rgb(var(--text-secondary))]">
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Subject Name</th>
                            <th className="py-2 px-3">Credits</th>
                            <th className="py-2 px-3">Grade</th>
                            <th className="py-2 px-3">Grade Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedSubjects.map((subject, idx) => (
                            <tr key={subject.id} className="border-b border-[rgb(var(--border))] last:border-0">
                              <td className="py-2 px-3 text-[rgb(var(--text-secondary))]">{idx + 1}</td>
                              <td className="py-2 px-3 font-medium">{subject.name}</td>
                              <td className="py-2 px-3">
                                {subject.grade === 'CP' || subject.grade === 'Completed' ? (
                                  <span className="font-semibold text-[rgb(var(--text-secondary))]">--</span>
                                ) : (
                                  subject.credits
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-bold transition-all duration-150 hover:scale-105 ${
                                  subject.grade === 'S' || subject.grade === 'A'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300/80 shadow-[0_0_8px_rgba(16,185,129,0.15)] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/60' :
                                  subject.grade === 'B' || subject.grade === 'C'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-300/80 shadow-[0_0_8px_rgba(59,130,246,0.15)] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/60' :
                                  subject.grade === 'D' || subject.grade === 'E'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-300/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60' :
                                  subject.grade === 'F'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-300/80 shadow-[0_0_8px_rgba(244,63,94,0.15)] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/60' :
                                  subject.grade === 'CP' || subject.grade === 'Completed'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-300/80 shadow-[0_0_8px_rgba(168,85,247,0.15)] dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700/60' :
                                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                }`}>
                                  {subject.grade === 'Completed' ? 'CP' : (subject.grade || '—')}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {subject.grade === 'CP' || subject.grade === 'Completed' ? (
                                  <span className="font-semibold text-[rgb(var(--text-secondary))]">--</span>
                                ) : (
                                  subject.grade_points ?? '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal()
            }
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div className="bg-[rgb(var(--bg-secondary))] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[rgb(var(--border))]">
              <h3 className="text-xl font-semibold">
                {editingSemesterId ? `Edit Semester (${selectedSemester || 'Details'})` : 'Add Semester'}
              </h3>
              <button onClick={closeModal} className="text-2xl hover:bg-[rgb(var(--bg-tertiary))] w-8 h-8 rounded-lg">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5">Select Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => handleSemesterSelectChange(e.target.value)}
                  className="input-field"
                >
                  <option value="">-- Choose Semester --</option>
                  {[
                    { value: '1-1', label: '1st Year, 1st Sem (1-1)' },
                    { value: '1-2', label: '1st Year, 2nd Sem (1-2)' },
                    { value: '2-1', label: '2nd Year, 1st Sem (2-1)' },
                    { value: '2-2', label: '2nd Year, 2nd Sem (2-2)' },
                    { value: '3-1', label: '3rd Year, 1st Sem (3-1)' },
                    { value: '3-2', label: '3rd Year, 2nd Sem (3-2)' },
                    { value: '4-1', label: '4th Year, 1st Sem (4-1)' },
                    { value: '4-2', label: '4th Year, 2nd Sem (4-2)' },
                  ].map(opt => {
                    const [y, s] = opt.value.split('-').map(Number)
                    const exists = semesters.some(sem => (sem.year === y && sem.semester_number === s) || sem.label === opt.value)
                    return (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} {exists ? '• (Already Added)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="border-b border-[rgb(var(--border))]">
                    <tr className="text-left text-[rgb(var(--text-secondary))]">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Subject Name</th>
                      <th className="py-2 px-2">Credits</th>
                      <th className="py-2 px-2">Grade</th>
                      <th className="py-2 px-2">Grade Points</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalSubjects.map((subject, idx) => (
                      <tr key={subject.id} className="border-b border-[rgb(var(--border))]">
                        <td className="py-2 px-2">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={subject.name}
                            onChange={(e) => updateModalSubject(idx, 'name', e.target.value)}
                            className="input-field text-sm py-1"
                            placeholder="Subject name"
                          />
                        </td>
                        <td className="py-2 px-2">
                          {subject.grade === 'CP' || subject.grade === 'Completed' ? (
                            <div className="input-field text-sm py-1 w-20 text-center text-[rgb(var(--text-secondary))] bg-[rgb(var(--bg-tertiary))] cursor-not-allowed select-none font-semibold">
                              --
                            </div>
                          ) : (
                            <select
                              value={subject.credits}
                              onChange={(e) => updateModalSubject(idx, 'credits', parseFloat(e.target.value))}
                              className="input-field text-sm py-1 w-20"
                            >
                              <option value={0}>0</option>
                              <option value={0.5}>0.5</option>
                              <option value={1}>1</option>
                              <option value={1.5}>1.5</option>
                              <option value={2}>2</option>
                              <option value={2.5}>2.5</option>
                              <option value={3}>3</option>
                              <option value={3.5}>3.5</option>
                              <option value={4}>4</option>
                            </select>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={subject.grade === 'Completed' ? 'CP' : (subject.grade || '')}
                            onChange={(e) => updateModalSubject(idx, 'grade', e.target.value || null)}
                            className="input-field text-sm py-1"
                          >
                            <option value="">—</option>
                            {['S', 'A', 'B', 'C', 'D', 'E', 'F', 'CP'].map(g => (
                              <option key={g} value={g}>{g === 'CP' ? 'CP (Completed)' : g}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          {subject.grade === 'CP' || subject.grade === 'Completed' ? (
                            <div className="input-field text-sm py-1 w-20 text-center text-[rgb(var(--text-secondary))] bg-[rgb(var(--bg-tertiary))] cursor-not-allowed select-none font-semibold">
                              --
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={subject.grade_points ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                                updateModalSubject(idx, 'grade_points', isNaN(val as number) ? null : val)
                              }}
                              className="input-field text-sm py-1 w-20 text-center"
                              placeholder="—"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => deleteModalRow(idx)}
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button onClick={addModalRow} className="btn-secondary text-xs sm:text-sm">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z"/>
                  </svg>
                  Add Row
                </button>
                <button
                  onClick={() => addMultipleModalRows(3)}
                  className="btn-secondary text-xs sm:text-sm"
                  title="Quick add 3 empty rows"
                >
                  +3 Rows
                </button>
                <button
                  onClick={clearEmptyModalRows}
                  className="btn-ghost text-xs sm:text-sm text-[rgb(var(--text-secondary))] hover:text-red-600"
                  title="Remove rows with no subject name"
                >
                  Clean Empty Rows
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-5 sm:p-6 border-t border-[rgb(var(--border))] gap-4 bg-[rgb(var(--bg-primary))]/50">
              {/* Dynamic Live SGPA Meter & Badge */}
              <div className="flex flex-col gap-1.5 flex-1 max-w-md">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[rgb(var(--text-secondary))] uppercase tracking-wider">
                    Expected SGPA:
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                    modalSGPA >= 9
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : modalSGPA >= 8
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                      : modalSGPA >= 7
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                      : modalSGPA >= 5
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                      : modalSGPA > 0
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                  }`}>
                    {modalSGPA > 0 ? modalSGPA.toFixed(2) : '—'}
                  </span>
                  <span className="text-xs text-[rgb(var(--text-secondary))]">
                    ({modalSubjects.filter(s => s.grade && s.grade !== 'CP' && s.grade !== 'Completed' && s.grade !== 'F' && s.grade_points !== null).length} graded,{' '}
                    {modalSubjects.reduce((sum, s) => s.grade === 'CP' || s.grade === 'Completed' ? sum : sum + (s.grade ? s.credits : 0), 0)} cr)
                  </span>
                </div>
                {/* Visual live progress bar */}
                <div className="w-full bg-[rgb(var(--bg-tertiary))] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      modalSGPA >= 9
                        ? 'bg-emerald-500'
                        : modalSGPA >= 8
                        ? 'bg-blue-500'
                        : modalSGPA >= 7
                        ? 'bg-indigo-500'
                        : modalSGPA >= 5
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(Math.max((modalSGPA / 10) * 100, 0), 100)}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 justify-end shrink-0">
                <button onClick={closeModal} className="btn-ghost">
                  Cancel
                </button>
                <button onClick={saveSemester} disabled={!selectedSemester} className="btn-primary">
                  {editingSemesterId ? 'Update Semester' : 'Save Semester'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Official Transcript Modal */}
      {showPrintModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPrintModal(false)
            }
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
        >
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden my-8">
            {/* Modal Control Bar (Hidden when printed) */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gray-50 dark:bg-slate-800/90 border-b border-gray-200 dark:border-slate-700 no-print">
              {/* Back Arrow button at top corner */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 sm:p-2 -ml-1 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 dark:text-gray-200 dark:hover:text-white dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold"
                  title="Go back to Dashboard"
                  aria-label="Go back"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back</span>
                </button>
                <div className="h-5 w-px bg-gray-300 dark:bg-slate-600" />
                <div className="flex items-center gap-2">
                  <span className="text-lg">🖨️</span>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-display">
                    Official Grade Transcript
                  </h3>
                </div>
              </div>

              {/* Action Buttons: Download, Print, and Close */}
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadTranscriptPDF}
                  disabled={isGeneratingPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors"
                  title="Download transcript as PDF"
                >
                  {isGeneratingPDF ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Generating…</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-xl hover:bg-gray-200/80 dark:hover:bg-slate-700 transition-colors ml-1"
                  title="Close modal"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Transcript Document */}
            <div id="printable-transcript-document" className="p-6 sm:p-10 bg-white text-gray-900">
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b-2 border-gray-900 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">🎓</span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 font-display">
                      EduGrade Academic Transcript
                    </h1>
                  </div>
                  <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">
                    Official Student Grade Point Performance Record
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-gray-600 space-y-1">
                  <div><strong>Student ID:</strong> {user?.email || 'Registered Scholar'}</div>
                  <div><strong>Issue Date:</strong> {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  <div><strong>Grading System:</strong> Standard 10.0 Scale</div>
                </div>
              </div>

              {/* Cumulative Performance Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200 mb-8">
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500">Cumulative GPA (CGPA)</div>
                  <div className="text-2xl font-black text-gray-900 font-display">
                    {cgpa > 0 ? cgpa.toFixed(2) : '—'} <span className="text-xs font-normal text-gray-500">/ 10.0</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500">Academic Standing</div>
                  <div className="text-sm font-bold text-primary-700 mt-1">
                    {badge.label}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500">Total Credits Earned</div>
                  <div className="text-2xl font-bold text-gray-900">{totalCredits}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500">Total Courses / Backlogs</div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">
                    {totalSubjects} courses {totalBacklogs > 0 ? `(${totalBacklogs} Backlogs)` : '(0 Backlogs)'}
                  </div>
                </div>
              </div>

              {/* Semester by Semester Breakdown */}
              <div className="space-y-6">
                {semesters.map(semester => {
                  const semSgpa = calculateSGPA(semester.subjects)
                  const semCreds = semester.subjects.reduce((sum, s) =>
                    s.grade === 'CP' || s.grade === 'Completed' ? sum : sum + s.credits, 0
                  )

                  return (
                    <div key={semester.id} className="border border-gray-300 rounded-xl overflow-hidden print-card">
                      <div className="bg-gray-100 px-4 py-2.5 flex items-center justify-between border-b border-gray-300">
                        <span className="font-bold text-sm text-gray-900">
                          Semester {semester.label}
                        </span>
                        <div className="text-xs space-x-3 text-gray-700 font-medium">
                          <span>Credits: <strong>{semCreds}</strong></span>
                          <span>SGPA: <strong className="text-gray-900 font-bold">{semSgpa > 0 ? semSgpa.toFixed(2) : '—'}</strong></span>
                        </div>
                      </div>

                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-left">
                          <tr>
                            <th className="py-2 px-3 w-10">#</th>
                            <th className="py-2 px-3">Subject / Course Name</th>
                            <th className="py-2 px-3 w-20 text-center">Credits</th>
                            <th className="py-2 px-3 w-20 text-center">Grade</th>
                            <th className="py-2 px-3 w-24 text-center">Grade Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {semester.subjects.map((sub, i) => (
                            <tr key={sub.id} className="hover:bg-gray-50/50">
                              <td className="py-2 px-3 text-gray-400 text-center">{i + 1}</td>
                              <td className="py-2 px-3 font-medium text-gray-900">{sub.name}</td>
                              <td className="py-2 px-3 text-center">
                                {sub.grade === 'CP' || sub.grade === 'Completed' ? '--' : sub.credits}
                              </td>
                              <td className="py-2 px-3 text-center font-bold">
                                {sub.grade === 'Completed' ? 'CP' : (sub.grade || '—')}
                              </td>
                              <td className="py-2 px-3 text-center font-semibold text-gray-700">
                                {sub.grade === 'CP' || sub.grade === 'Completed' ? '--' : (sub.grade_points ?? '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>

              {/* Grading Scheme Legend & Verification */}
              <div className="mt-8 pt-6 border-t border-gray-300 text-[11px] text-gray-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <strong>Grading Key:</strong> S: 10 | A: 9 | B: 8 | C: 7 | D: 6 | E: 5 | F: 0 | CP: Completed (Non-credit Audit)
                  <p className="mt-0.5">Verified electronic academic transcript generated via EduGrade.</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="h-8 border-b border-gray-400 w-36 mb-1"></div>
                  <span className="text-[10px] uppercase font-semibold text-gray-400">Authorized Signature / Seal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  )
}
