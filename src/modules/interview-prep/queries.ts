import { prisma } from '@/lib/db'
import { normalizeSections } from './schema'

export type PrepSessionListItem = {
  id: string
  title: string
  company: string | null
  jobTitle: string | null
  status: string
  updatedAt: Date
  createdAt: Date
  _count: { notes: number; documents: number; interviewers: number }
}

export type PrepNoteRow = {
  id: string
  title: string
  sections: ReturnType<typeof normalizeSections>
  order: number
  updatedAt: Date
}

export type PrepDocumentRow = {
  id: string
  name: string
  docType: string
  content: string
  aiAnalysis: unknown
  aiAnalysedAt: Date | null
  createdAt: Date
}

export type PrepInterviewerRow = {
  id: string
  name: string
  role: string | null
  linkedInText: string | null
  notes: string | null
  aiAnalysis: unknown
  aiAnalysedAt: Date | null
  createdAt: Date
}

export type PrepSessionWithChildren = {
  id: string
  title: string
  company: string | null
  jobTitle: string | null
  jobApplicationId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  notes: PrepNoteRow[]
  documents: PrepDocumentRow[]
  interviewers: PrepInterviewerRow[]
  jobApplication: { id: string; title: string; company: string | null } | null
}

export async function listSessions(profileId: string): Promise<PrepSessionListItem[]> {
  return prisma.interviewPrepSession.findMany({
    where: { profileId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      company: true,
      jobTitle: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { notes: true, documents: true, interviewers: true } },
    },
  })
}

export async function getSession(
  profileId: string,
  id: string,
): Promise<PrepSessionWithChildren | null> {
  const row = await prisma.interviewPrepSession.findFirst({
    where: { id, profileId },
    select: {
      id: true,
      title: true,
      company: true,
      jobTitle: true,
      jobApplicationId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      jobApplication: { select: { id: true, title: true, company: true } },
      notes: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, sections: true, order: true, updatedAt: true },
      },
      documents: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, docType: true, content: true, aiAnalysis: true, aiAnalysedAt: true, createdAt: true },
      },
      interviewers: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, role: true, linkedInText: true, notes: true, aiAnalysis: true, aiAnalysedAt: true, createdAt: true },
      },
    },
  })

  if (!row) return null

  return {
    ...row,
    notes: row.notes.map(n => ({
      ...n,
      sections: normalizeSections(n.sections),
    })),
  }
}
