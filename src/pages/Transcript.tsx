import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
// @ts-ignore
import html2pdf from 'html2pdf.js'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { calculateCGPA, calculateSGPA, getCGPABadge } from '../lib/grading'
import type { Semester } from '../lib/grading'

export function Transcript() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [semesters, setSemesters] = useState<Semester[]>(() => {
    return (location.state as any)?.semesters || []
  })
  const [loading, setLoading] = useState(semesters.length === 0)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (semesters.length === 0 && user) {
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
    } catch (err: any) {
      showToast('Error loading transcript: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const cgpa = calculateCGPA(semesters)
  const badge = getCGPABadge(cgpa)
  const totalCredits = semesters.reduce((sum, sem) =>
    sum + sem.subjects.reduce((acc, sub) =>
      sub.grade === 'CP' || sub.grade === 'Completed' ? acc : acc + sub.credits, 0
    ), 0
  )
  const totalSubjects = semesters.reduce((sum, sem) => sum + sem.subjects.length, 0)
  const totalBacklogs = semesters.reduce((sum, sem) =>
    sum + sem.subjects.filter(s => s.grade === 'F').length, 0
  )

  const downloadPDF = async () => {
    const el = document.getElementById('full-transcript-document')
    if (!el) return

    setIsGeneratingPDF(true)
    try {
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `EduGrade_Transcript_${user?.email ? user.email.split('@')[0] : 'Student'}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, windowWidth: 1024 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] },
      }
      await html2pdf().set(opt).from(el).save()
      showToast('📥 PDF downloaded successfully!')
    } catch {
      showToast('PDF error. Please use "Print / Save PDF" to save directly.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[rgb(var(--bg-primary))] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[rgb(var(--text-secondary))]">Generating Official Transcript…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-primary))] pb-16">
      {/* Sticky Teal Control Bar (Hidden when printed) */}
      <header className="sticky top-0 z-50 bg-[#042f2e]/95 dark:bg-[#042f2e]/95 backdrop-blur-md border-b border-teal-500/30 text-white shadow-xl no-print">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Back button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-950/60 hover:bg-teal-900 border border-teal-500/30 text-xs sm:text-sm font-semibold text-teal-200 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Dashboard</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-teal-100 font-display font-bold text-sm">
            <span className="text-lg">🎓</span> Official Academic Transcript
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-teal-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-950/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Print all pages or save as PDF via browser"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={downloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-900/80 hover:bg-teal-800 border border-teal-500/40 text-teal-100 font-semibold text-xs sm:text-sm transition-all disabled:opacity-50"
            >
              {isGeneratingPDF ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Full Page Printable Document */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8">
        <div
          id="full-transcript-document"
          className="bg-white text-gray-900 rounded-2xl shadow-2xl p-6 sm:p-12 border border-gray-200"
        >
          {/* Institution & Student Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b-2 border-teal-800 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">🎓</span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 font-display">
                  EduGrade Academic Transcript
                </h1>
              </div>
              <p className="text-xs text-teal-800 uppercase tracking-widest font-bold">
                Comprehensive Multi-Semester Grade & Credit Performance Record
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-gray-600 space-y-1">
              <div><strong>Scholar ID:</strong> {user?.email || 'Registered Scholar'}</div>
              <div><strong>Issue Date:</strong> {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div><strong>Grading System:</strong> 10-Point Indian Engineering Standard</div>
            </div>
          </div>

          {/* Cumulative Performance Snapshot with Teal Accents */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-teal-50/60 border border-teal-200 mb-8">
            <div>
              <div className="text-[10px] uppercase font-bold text-teal-800">Cumulative GPA (CGPA)</div>
              <div className="text-2xl font-black text-gray-900 font-display mt-0.5">
                {cgpa > 0 ? cgpa.toFixed(2) : '—'} <span className="text-xs font-normal text-gray-500">/ 10.0</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-teal-800">Equivalent Percentage</div>
              <div className="text-2xl font-black text-teal-700 font-display mt-0.5">
                {cgpa > 0 ? `${Math.max(0, (cgpa - 0.75) * 10).toFixed(1)}%` : '—'}
              </div>
              <span className="text-[9px] text-gray-500">(CGPA - 0.75) × 10</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-teal-800">Total Credits Earned</div>
              <div className="text-2xl font-bold text-gray-900 mt-0.5">{totalCredits}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-teal-800">Standing & Backlogs</div>
              <div className="text-sm font-bold text-teal-900 mt-1">
                {badge.label}
              </div>
              <span className="text-[10px] text-gray-500">
                {totalSubjects} courses {totalBacklogs > 0 ? `(${totalBacklogs} Active Backlogs)` : '(0 Backlogs)'}
              </span>
            </div>
          </div>

          {/* Every Semester Breakdown (1-1, 1-2, 2-1, 2-2, 3-1, 3-2, 4-1, 4-2) */}
          <div className="space-y-6">
            {semesters.map((semester) => {
              const semSgpa = calculateSGPA(semester.subjects)
              const semCreds = semester.subjects.reduce((sum, s) =>
                s.grade === 'CP' || s.grade === 'Completed' ? sum : sum + s.credits, 0
              )

              return (
                <div key={semester.id} className="border border-gray-300 rounded-xl overflow-hidden print-card">
                  {/* Semester Bar */}
                  <div className="bg-teal-50 px-4 py-2.5 flex items-center justify-between border-b border-teal-200">
                    <span className="font-bold text-sm text-teal-950 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                      Semester {semester.label}
                    </span>
                    <div className="text-xs space-x-4 text-gray-700 font-medium">
                      <span>Credits: <strong className="text-gray-900">{semCreds}</strong></span>
                      <span>SGPA: <strong className="text-teal-800 font-bold text-sm">{semSgpa > 0 ? semSgpa.toFixed(2) : '—'}</strong></span>
                    </div>
                  </div>

                  {/* Course Table */}
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-left">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Subject / Course Name</th>
                        <th className="py-2.5 px-3 w-20 text-center">Credits</th>
                        <th className="py-2.5 px-3 w-20 text-center">Grade</th>
                        <th className="py-2.5 px-3 w-24 text-center">Grade Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {semester.subjects.map((sub, i) => (
                        <tr key={sub.id} className="hover:bg-gray-50/50">
                          <td className="py-2 px-3 text-gray-400 text-center font-mono">{i + 1}</td>
                          <td className="py-2 px-3 font-semibold text-gray-900">{sub.name}</td>
                          <td className="py-2 px-3 text-center text-gray-700 font-medium">
                            {sub.grade === 'CP' || sub.grade === 'Completed' ? '--' : sub.credits}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                              sub.grade === 'S' || sub.grade === 'A'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sub.grade === 'F'
                                ? 'bg-rose-100 text-rose-800'
                                : sub.grade === 'CP' || sub.grade === 'Completed'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {sub.grade === 'Completed' ? 'CP' : (sub.grade || '—')}
                            </span>
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

          {/* Grading Legend & Seal Footer */}
          <div className="mt-10 pt-6 border-t-2 border-gray-300 text-[11px] text-gray-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <strong>Grading Scheme:</strong> S / O: 10 | A: 9 | B: 8 | C: 7 | D: 6 | E: 5 | F: 0 | CP: Completed
              <p className="mt-0.5">Official authenticated electronic transcript generated via EduGrade Academic Portal.</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="h-8 border-b-2 border-gray-400 w-40 mb-1"></div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Authorized Signature / Seal</span>
            </div>
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-slide-up text-sm font-semibold border border-gray-700">
          {toast}
        </div>
      )}
    </div>
  )
}
