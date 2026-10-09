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
  const [toast, setToast] = useState('')

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
      const gradePoints = value && value !== 'Completed' ? GRADE_POINTS[value] : null
      updated[index].grade_points = gradePoints
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

    try {
      const [year, semNum] = selectedSemester.split('-').map(Number)

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
        name: s.name,
        credits: s.credits,
        grade: s.grade,
        grade_points: s.grade_points,
      }))

      const { error: subError } = await supabase
        .from('subjects')
        .insert(subjectsToInsert)

      if (subError) throw subError

      showToast('✅ Semester saved successfully!')
      setShowModal(false)
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
    sum + sem.subjects.reduce((s, sub) => s + sub.credits, 0), 0
  )
  const totalSubjects = semesters.reduce((sum, sem) => sum + sem.subjects.length, 0)
  const modalSGPA = calculateSGPA(modalSubjects)

  const sgpaValues = semesters.map(sem => calculateSGPA(sem.subjects))

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
        {/* CGPA Hero Card */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-8 mb-8 text-white shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-2">Overall CGPA</p>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-6xl font-bold font-display">
                  {cgpa > 0 ? cgpa.toFixed(2) : '—'}
                </span>
                {cgpa > 0 && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold bg-white/20`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6 text-primary-100">
                <div>
                  <span className="text-2xl font-semibold text-white">{semesters.length}</span>
                  <span className="text-sm ml-1">Semesters</span>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div>
                  <span className="text-2xl font-semibold text-white">{totalCredits}</span>
                  <span className="text-sm ml-1">Total Credits</span>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div>
                  <span className="text-2xl font-semibold text-white">{totalSubjects}</span>
                  <span className="text-sm ml-1">Subjects</span>
                </div>
              </div>
            </div>
            {sgpaValues.length > 0 && (
              <div className="text-center">
                <svg className="w-32 h-20" viewBox="0 0 120 80" fill="none">
                  <polyline
                    points={sgpaValues.map((sgpa, i) =>
                      `${10 + (i * (100 / Math.max(sgpaValues.length - 1, 1)))},${70 - (sgpa * 6)}`
                    ).join(' ')}
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-xs text-primary-100 mt-1">SGPA Trend</p>
              </div>
            )}
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
          <div className="space-y-4">
            {semesters.map(semester => {
              const sgpa = calculateSGPA(semester.subjects)
              return (
                <div key={semester.id} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{semester.label}</h3>
                      <p className="text-sm text-[rgb(var(--text-secondary))]">
                        SGPA: <span className="font-semibold text-[rgb(var(--text-primary))]">
                          {sgpa > 0 ? sgpa.toFixed(2) : '—'}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => deleteSemester(semester.id)}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                    >
                      🗑️
                    </button>
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
                            <td className="py-2 px-3">{subject.credits}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                subject.grade === 'S' || subject.grade === 'A' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                subject.grade === 'B' || subject.grade === 'C' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                subject.grade === 'D' || subject.grade === 'E' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                subject.grade === 'F' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              }`}>
                                {subject.grade || '—'}
                              </span>
                            </td>
                            <td className="py-2 px-3">{subject.grade_points ?? '—'}</td>
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
              <h3 className="text-xl font-semibold">Add Semester</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl hover:bg-[rgb(var(--bg-tertiary))] w-8 h-8 rounded-lg">
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
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={subject.grade || ''}
                            onChange={(e) => updateModalSubject(idx, 'grade', e.target.value || null)}
                            className="input-field text-sm py-1"
                          >
                            <option value="">—</option>
                            {GRADE_OPTIONS.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center">{subject.grade_points ?? '—'}</td>
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
                <button onClick={() => setShowModal(false)} className="btn-ghost">
                  Cancel
                </button>
                <button onClick={saveSemester} disabled={!selectedSemester} className="btn-primary">
                  Save Semester
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
