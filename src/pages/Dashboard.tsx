import { useEffect, useState } from 'react'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { calculateCGPA, calculateSGPA, getCGPABadge, GRADE_OPTIONS, GRADE_POINTS } from '../lib/grading'
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

  useEffect(() => {
    if (user) {
      loadSemesters()
    }
  }, [user])

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

  const updateModalSubject = (index: number, field: keyof Subject, value: any) => {
    const updated = [...modalSubjects]
    updated[index] = { ...updated[index], [field]: value }

    if (field === 'grade') {
      if (value === 'CP' || value === 'Completed') {
        updated[index].credits = 0
        updated[index].grade_points = null
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

    // Check for duplicate semester if creating or changing label
    const duplicate = semesters.find(
      s => s.label === selectedSemester && s.id !== editingSemesterId
    )
    if (duplicate) {
      showToast(`Semester ${selectedSemester} already exists`)
      return
    }

    try {
      const [year, semNum] = selectedSemester.split('-').map(Number)

      if (editingSemesterId) {
        // Update semester
        const { error: semError } = await supabase
          .from('semesters')
          .update({
            label: selectedSemester,
            year,
            semester_number: semNum,
          })
          .eq('id', editingSemesterId)

        if (semError) throw semError

        // Manage subjects for the edited semester
        const originalSemester = semesters.find(s => s.id === editingSemesterId)
        const originalSubjectIds = originalSemester ? originalSemester.subjects.map(s => s.id) : []

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
          const { error: updError } = await supabase
            .from('subjects')
            .update({
              name: s.name.trim(),
              credits: s.credits,
              grade: s.grade,
              grade_points: s.grade_points,
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
              newToInsert.map(s => ({
                semester_id: editingSemesterId,
                user_id: user.id,
                name: s.name.trim(),
                credits: s.credits,
                grade: s.grade,
                grade_points: s.grade_points,
              }))
            )

          if (insError) throw insError
        }

        showToast('✅ Semester updated successfully!')
      } else {
        // Insert new semester
        const { data: semData, error: semError } = await supabase
          .from('semesters')
          .insert({
            user_id: user.id,
            label: selectedSemester,
            year,
            semester_number: semNum,
          })
          .select()
          .single()

        if (semError) throw semError

        const subjectsToInsert = validSubjects.map(s => ({
          semester_id: semData.id,
          user_id: user.id,
          name: s.name.trim(),
          credits: s.credits,
          grade: s.grade,
          grade_points: s.grade_points,
        }))

        const { error: subError } = await supabase
          .from('subjects')
          .insert(subjectsToInsert)

        if (subError) throw subError

        showToast('✅ Semester saved successfully!')
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-primary))]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* CGPA Hero Card with Glassmorphism & Micro-Gradients */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 rounded-3xl p-6 sm:p-8 mb-8 text-white shadow-xl shadow-primary-950/20 border border-white/10">
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

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-semibold">My Semesters</h2>
          <button onClick={openModal} className="btn-primary">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z"/>
            </svg>
            Add Semester
          </button>
        </div>

        {/* Semesters Grid */}
        {semesters.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-6xl mb-4">🎓</div>
            <p className="text-xl font-semibold mb-2">No semesters yet</p>
            <p className="text-[rgb(var(--text-secondary))]">Click "Add Semester" to start tracking your grades.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {semesters.map(semester => {
              const sgpa = calculateSGPA(semester.subjects)
              const semCredits = semester.subjects.reduce((sum, s) =>
                s.grade === 'CP' || s.grade === 'Completed' ? sum : sum + s.credits, 0
              )
              return (
                <div
                  key={semester.id}
                  className="card hover:shadow-lg hover:border-primary-500/30 transition-all duration-300 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-bold font-display text-[rgb(var(--text-primary))]">
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
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        SGPA: {sgpa > 0 ? sgpa.toFixed(2) : '—'}
                      </span>
                      <span className="text-xs text-[rgb(var(--text-secondary))] font-medium">
                        • {semCredits} Credits
                      </span>
                      <span className="text-xs text-[rgb(var(--text-secondary))] font-medium">
                        • {semester.subjects.length} Subjects
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
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

                  <div className="overflow-x-auto">
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
                        {semester.subjects.map((subject, idx) => (
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
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                subject.grade === 'S' || subject.grade === 'A' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                subject.grade === 'B' || subject.grade === 'C' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                subject.grade === 'D' || subject.grade === 'E' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                subject.grade === 'F' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                subject.grade === 'CP' || subject.grade === 'Completed' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              }`}>
                                {subject.grade || '—'}
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
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="input-field"
                >
                  <option value="">-- Choose Semester --</option>
                  <option value="1-1">1st Year, 1st Sem (1-1)</option>
                  <option value="1-2">1st Year, 2nd Sem (1-2)</option>
                  <option value="2-1">2nd Year, 1st Sem (2-1)</option>
                  <option value="2-2">2nd Year, 2nd Sem (2-2)</option>
                  <option value="3-1">3rd Year, 1st Sem (3-1)</option>
                  <option value="3-2">3rd Year, 2nd Sem (3-2)</option>
                  <option value="4-1">4th Year, 1st Sem (4-1)</option>
                  <option value="4-2">4th Year, 2nd Sem (4-2)</option>
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
                            value={subject.grade || ''}
                            onChange={(e) => updateModalSubject(idx, 'grade', e.target.value || null)}
                            className="input-field text-sm py-1"
                          >
                            <option value="">—</option>
                            {GRADE_OPTIONS.map(g => (
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

              <button onClick={addModalRow} className="btn-secondary">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z"/>
                </svg>
                Add Subject Row
              </button>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-[rgb(var(--border))]">
              <div className="text-sm">
                Computed SGPA: <strong className="text-lg">{modalSGPA > 0 ? modalSGPA.toFixed(2) : '—'}</strong>
              </div>
              <div className="flex gap-3">
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  )
}
