import { tool, zodSchema } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { parseJsonField } from '@/lib/utils'

type OwnershipTable =
  | 'cVDocument'
  | 'jobApplication'
  | 'interviewPrepSession'
  | 'coverLetterDocument'

// Security: every tool verifies the resource belongs to the session's profileId.
// profileId is always resolved server-side from the session cookie — never from
// LLM-generated tool arguments.
export async function assertOwnership(
  table: OwnershipTable,
  id: string,
  profileId: string,
): Promise<void> {
  const row = await (prisma[table] as any).findUnique({
    where: { id },
    select: { profileId: true },
  })
  if (!row || row.profileId !== profileId) {
    throw new Error('Resource not found or access denied')
  }
}

export function createChatTools(profileId: string) {
  return {
    get_profile_section: tool({
      description:
        "Fetch detailed data for a section of the user's profile. Use when you need more depth than the profile overview provides.",
      inputSchema: zodSchema(
        z.object({
          section: z.enum(['skills', 'experience', 'projects', 'education', 'certifications']),
        }),
      ),
      execute: async ({ section }) => {
        switch (section) {
          case 'skills':
            return prisma.skill
              .findMany({ where: { profileId }, orderBy: [{ level: 'asc' }, { name: 'asc' }] })
              .then(rows =>
                rows.map(s => ({
                  name: s.name,
                  category: s.category,
                  level: s.level,
                  yearsOfExperience: s.yearsOfExperience,
                  notes: s.notes,
                  tags: parseJsonField<string[]>(s.tags, []),
                })),
              )
          case 'experience':
            return prisma.experience
              .findMany({
                where: { profileId },
                include: { activities: true },
                orderBy: { startDate: 'desc' },
              })
              .then(rows =>
                rows.map(e => ({
                  company: e.company,
                  role: e.role,
                  startDate: e.startDate,
                  endDate: e.endDate,
                  summary: e.summary,
                  remote: e.remote,
                  achievements: e.activities
                    .filter(a => a.kind === 'achievement')
                    .sort((a, b) => a.order - b.order)
                    .map(a => a.description),
                  responsibilities: e.activities
                    .filter(a => a.kind === 'responsibility')
                    .sort((a, b) => a.order - b.order)
                    .map(a => a.description),
                  tags: parseJsonField<string[]>(e.tags, []),
                })),
              )
          case 'projects':
            return prisma.project
              .findMany({ where: { profileId }, orderBy: { startDate: 'desc' } })
              .then(rows =>
                rows.map(p => ({
                  name: p.name,
                  description: p.description,
                  status: p.status,
                  url: p.url,
                  highlights: parseJsonField<string[]>(p.highlights, []),
                  tags: parseJsonField<string[]>(p.tags, []),
                })),
              )
          case 'education':
            return prisma.education.findMany({ where: { profileId }, orderBy: { startDate: 'desc' } })
          case 'certifications':
            return prisma.certification.findMany({
              where: { profileId },
              orderBy: { issueDate: 'desc' },
            })
        }
      },
    }),

    get_job_application: tool({
      description: 'Fetch a job application including full job description, fit score, and notes.',
      inputSchema: zodSchema(z.object({ jobId: z.string() })),
      execute: async ({ jobId }) => {
        await assertOwnership('jobApplication', jobId, profileId)
        const job = await prisma.jobApplication.findUnique({ where: { id: jobId } })
        if (!job) throw new Error('Job application not found')
        return {
          company: job.company,
          jobTitle: job.title,
          status: job.status,
          jobDescription: job.jobDescription,
          notes: job.notes,
          jobFit: job.jobFit,
        }
      },
    }),

    get_cv_document: tool({
      description:
        "Fetch the full JSON content of a CV document. Use when the user wants to discuss or modify their CV.",
      inputSchema: zodSchema(z.object({ cvId: z.string() })),
      execute: async ({ cvId }) => {
        await assertOwnership('cVDocument', cvId, profileId)
        const cv = await prisma.cVDocument.findUnique({ where: { id: cvId } })
        if (!cv) throw new Error('CV document not found')
        return { id: cv.id, jobTitle: cv.jobTitle, company: cv.company, content: cv.generatedContent }
      },
    }),

    get_interview_prep: tool({
      description: 'Fetch an interview prep session including notes, documents, and interviewers.',
      inputSchema: zodSchema(z.object({ sessionId: z.string() })),
      execute: async ({ sessionId }) => {
        await assertOwnership('interviewPrepSession', sessionId, profileId)
        return prisma.interviewPrepSession.findUnique({
          where: { id: sessionId },
          include: {
            notes: { orderBy: { order: 'asc' } },
            documents: true,
            interviewers: true,
          },
        })
      },
    }),

    // Write tools — no execute → client handles with confirmation card.
    propose_profile_update: tool({
      description:
        "Propose an update to a field on the user's profile. The user must confirm before it is applied.",
      inputSchema: zodSchema(
        z.object({
          field: z.string().describe('The profile field to update (e.g. "headline")'),
          currentValue: z.string().describe('The current value'),
          proposedValue: z.string().describe('The proposed new value'),
          rationale: z.string().describe('Why this change improves the profile'),
        }),
      ),
    }),

    propose_cv_update: tool({
      description:
        'Propose an update to a section of a CV document. The user must confirm before it is applied.',
      inputSchema: zodSchema(
        z.object({
          cvId: z.string(),
          sectionId: z.string().describe('The id of the CVSection to update'),
          sectionType: z.string().describe('The type of the section (e.g. "profile", "experience")'),
          proposedData: z.record(z.string(), z.unknown()).describe('Full proposed data object for the section'),
          rationale: z.string().describe('Why this change improves the CV'),
        }),
      ),
    }),

    propose_prep_note_update: tool({
      description:
        'Propose an update to a block in an interview prep note. The user must confirm before it is applied.',
      inputSchema: zodSchema(
        z.object({
          sessionId: z.string(),
          noteId: z.string(),
          blockId: z.string(),
          proposedContent: z.string().describe('The proposed new content for the block'),
          rationale: z.string().describe('Why this change improves the prep note'),
        }),
      ),
    }),
  }
}
