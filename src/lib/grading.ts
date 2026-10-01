// 10-point grading scale for Indian engineering programs
export const GRADE_POINTS: Record<string, number> = {
  'S': 10,
  'A': 9,
  'B': 8,
  'C': 7,
  'D': 6,
  'E': 5,
  'F': 0,
}

export const GRADE_OPTIONS = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'Completed']

export interface Subject {
  id: string
  name: string
  credits: number
  grade: string | null
  grade_points: number | null
}

export interface Semester {
  id: string
  label: string
  year: number
  semester_number: number
  subjects: Subject[]
}

/**
 * Calculate SGPA for a semester
 * Formula: SGPA = Σ(Credit × Grade Point) / Σ(Credits)
 * Excludes 'Completed' and 'F' grades from calculation
 */
export function calculateSGPA(subjects: Subject[]): number {
  const graded = subjects.filter(s =>
    s.grade &&
    s.grade !== 'Completed' &&
    s.grade !== 'F' &&
    s.grade_points !== null
  )

  if (graded.length === 0) return 0

  const totalWeightedPoints = graded.reduce((sum, s) =>
    sum + (s.credits * (s.grade_points || 0)), 0
  )

  const totalCredits = graded.reduce((sum, s) => sum + s.credits, 0)

  return totalCredits > 0 ? totalWeightedPoints / totalCredits : 0
}

/**
 * Calculate CGPA across all semesters
 * Formula: CGPA = Σ(All Credit × Grade Point) / Σ(All Credits)
 */
export function calculateCGPA(semesters: Semester[]): number {
  const allSubjects = semesters.flatMap(sem => sem.subjects)
  return calculateSGPA(allSubjects)
}

/**
 * Get CGPA badge based on score
 */
export function getCGPABadge(cgpa: number): { label: string; color: string } {
  if (cgpa >= 9) return { label: 'Distinction', color: 'green' }
  if (cgpa >= 7) return { label: 'First Class', color: 'blue' }
  if (cgpa >= 5) return { label: 'Pass', color: 'yellow' }
  return { label: 'At Risk', color: 'red' }
}

/**
 * Calculate required grade to reach target CGPA
 */
export function calculateRequiredGrade(
  currentCGPA: number,
  currentCredits: number,
  targetCGPA: number,
  newCredits: number
): number {
  const currentPoints = currentCGPA * currentCredits
  const requiredPoints = targetCGPA * (currentCredits + newCredits)
  const neededPoints = requiredPoints - currentPoints

  return newCredits > 0 ? neededPoints / newCredits : 0
}
