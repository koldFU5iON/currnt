'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireProfile } from '@/lib/session'
import { normalizeSections, type Block } from './schema'
import { nanoid } from 'nanoid'

// ─── Session ─────────────────────────────────────────────────

export async function createSession(input: {
  title: string
  company?: string
  jobTitle?: string
  jobApplicationId?: string
}): Promise<{ id: string }> {
  const { profile } = await requireProfile()

  let company = input.company ?? null
  let jobTitle = input.jobTitle ?? null

  if (input.jobApplicationId) {
    const job = await prisma.jobApplication.findFirst({
      where: { id: input.jobApplicationId, profileId: profile.id },
      select: { title: true, company: true },
    })
    if (job) {
      jobTitle = jobTitle ?? job.title
      company = company ?? job.company ?? null
    }
  }

  const session = await prisma.interviewPrepSession.create({
    data: {
      profileId: profile.id,
      title: input.title,
      company,
      jobTitle,
      jobApplicationId: input.jobApplicationId ?? null,
    },
    select: { id: true },
  })

  await prisma.prepNote.create({
    data: {
      sessionId: session.id,
      profileId: profile.id,
      title: 'Prep Notes',
      order: 0,
    },
  })

  revalidatePath('/dashboard/interview-prep')
  return { id: session.id }
}

export async function updateSessionDetails(
  sessionId: string,
  input: { title?: string; company?: string; jobTitle?: string },
): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.updateMany({
    where: { id: sessionId, profileId: profile.id },
    data: input,
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
}

export async function linkSessionToJob(
  sessionId: string,
  jobApplicationId: string | null,
): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.updateMany({
    where: { id: sessionId, profileId: profile.id },
    data: { jobApplicationId },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.interviewPrepSession.deleteMany({
    where: { id: sessionId, profileId: profile.id },
  })
  revalidatePath('/dashboard/interview-prep')
}

// ─── Notes ───────────────────────────────────────────────────

export async function createNote(sessionId: string, title: string): Promise<{ id: string }> {
  const { profile } = await requireProfile()
  const count = await prisma.prepNote.count({ where: { sessionId, profileId: profile.id } })
  const note = await prisma.prepNote.create({
    data: { sessionId, profileId: profile.id, title, order: count },
    select: { id: true },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
  return { id: note.id }
}

export async function renameNote(noteId: string, title: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepNote.updateMany({
    where: { id: noteId, profileId: profile.id },
    data: { title },
  })
}

export async function deleteNote(noteId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepNote.deleteMany({
    where: { id: noteId, profileId: profile.id },
  })
}

// ─── Documents ───────────────────────────────────────────────

export async function addDocument(
  sessionId: string,
  input: { name: string; docType: string; content: string },
): Promise<{ id: string }> {
  const { profile } = await requireProfile()
  const doc = await prisma.prepDocument.create({
    data: { sessionId, profileId: profile.id, ...input },
    select: { id: true },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
  return { id: doc.id }
}

export async function deleteDocument(documentId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepDocument.deleteMany({
    where: { id: documentId, profileId: profile.id },
  })
}

// ─── Interviewers ────────────────────────────────────────────

export async function addInterviewer(
  sessionId: string,
  input: { name: string; role?: string; linkedInText?: string; notes?: string },
): Promise<{ id: string }> {
  const { profile } = await requireProfile()
  const interviewer = await prisma.prepInterviewer.create({
    data: { sessionId, profileId: profile.id, ...input },
    select: { id: true },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
  return { id: interviewer.id }
}

export async function updateInterviewer(
  interviewerId: string,
  input: { name?: string; role?: string; linkedInText?: string; notes?: string },
): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepInterviewer.updateMany({
    where: { id: interviewerId, profileId: profile.id },
    data: input,
  })
}

export async function deleteInterviewer(interviewerId: string): Promise<void> {
  const { profile } = await requireProfile()
  await prisma.prepInterviewer.deleteMany({
    where: { id: interviewerId, profileId: profile.id },
  })
}

// ─── Block helpers (used only within this file) ───────────────

async function loadNote(noteId: string, profileId: string) {
  const note = await prisma.prepNote.findFirst({
    where: { id: noteId, profileId },
    select: { id: true, sessionId: true, sections: true },
  })
  if (!note) throw new Error('Note not found')
  return { ...note, blocks: normalizeSections(note.sections) }
}

async function saveBlocks(
  noteId: string,
  sessionId: string,
  blocks: ReturnType<typeof normalizeSections>,
): Promise<void> {
  const reindexed = [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((b, i) => ({ ...b, order: i }))
  await prisma.prepNote.update({
    where: { id: noteId },
    data: { sections: reindexed },
  })
  revalidatePath(`/dashboard/interview-prep/${sessionId}`)
}

// ─── Block operations ─────────────────────────────────────────

export async function addTextBlock(noteId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const newBlock = { id: nanoid(), type: 'text' as const, title: 'New block', content: '', order: note.blocks.length }
  await saveBlocks(noteId, note.sessionId, [...note.blocks, newBlock])
}

export async function updateBlock(
  noteId: string,
  blockId: string,
  updates: { title?: string; content?: string },
): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const updated = note.blocks.map((b: Block) => b.id === blockId ? { ...b, ...updates } : b)
  await saveBlocks(noteId, note.sessionId, updated)
}

export async function deleteBlock(noteId: string, blockId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const remaining = note.blocks.filter((b: Block) => b.id !== blockId)
  await saveBlocks(noteId, note.sessionId, remaining)
}

export async function moveBlockUp(noteId: string, blockId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const sorted = [...note.blocks].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex(b => b.id === blockId)
  if (idx <= 0) return
  const prevOrder = sorted[idx - 1].order
  const curOrder = sorted[idx].order
  sorted[idx - 1] = { ...sorted[idx - 1], order: curOrder }
  sorted[idx] = { ...sorted[idx], order: prevOrder }
  await saveBlocks(noteId, note.sessionId, sorted)
}

export async function moveBlockDown(noteId: string, blockId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const sorted = [...note.blocks].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex(b => b.id === blockId)
  if (idx < 0 || idx >= sorted.length - 1) return
  const curOrder = sorted[idx].order
  const nextOrder = sorted[idx + 1].order
  sorted[idx] = { ...sorted[idx], order: nextOrder }
  sorted[idx + 1] = { ...sorted[idx + 1], order: curOrder }
  await saveBlocks(noteId, note.sessionId, sorted)
}

export async function convertAiBlockToText(noteId: string, blockId: string): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const updated = note.blocks.map((b: Block) => {
    if (b.id !== blockId || b.type !== 'ai-analysis') return b
    return { id: b.id, type: 'text' as const, title: b.title, content: b.content, order: b.order }
  })
  await saveBlocks(noteId, note.sessionId, updated)
}

export async function insertAiBlock(
  noteId: string,
  block: { title: string; content: string; sourceDocIds?: string[]; sourceInterviewerIds?: string[] },
): Promise<void> {
  const { profile } = await requireProfile()
  const note = await loadNote(noteId, profile.id)
  const newBlock = {
    id: nanoid(),
    type: 'ai-analysis' as const,
    title: block.title,
    content: block.content,
    sourceDocIds: block.sourceDocIds ?? [],
    sourceInterviewerIds: block.sourceInterviewerIds ?? [],
    order: note.blocks.length,
  }
  await saveBlocks(noteId, note.sessionId, [...note.blocks, newBlock])
}
