import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/session'
import { prisma } from '@/lib/db'
import { createSession } from '@/modules/interview-prep/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function NewInterviewPrepPage() {
  const { profile } = await requireProfile()

  const jobs = await prisma.jobApplication.findMany({
    where: { profileId: profile.id, archivedAt: null },
    orderBy: { lastUpdated: 'desc' },
    select: { id: true, title: true, company: true },
    take: 50,
  })

  async function handleCreate(formData: FormData) {
    'use server'
    const title = formData.get('title') as string
    const jobApplicationId = (formData.get('jobApplicationId') as string) || undefined
    if (!title?.trim()) return
    const { id } = await createSession({ title: title.trim(), jobApplicationId })
    redirect(`/dashboard/interview-prep/${id}`)
  }

  return (
    <div className="container max-w-lg py-8">
      <h1 className="mb-6 text-xl font-semibold">New Prep Session</h1>
      <form action={handleCreate} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Session title</Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g. Senior Product Designer @ Acme"
            required
            autoFocus
          />
        </div>

        {jobs.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="jobApplicationId">Link to a job (optional)</Label>
            <select
              id="jobApplicationId"
              name="jobApplicationId"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.title}{job.company ? ` · ${job.company}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Auto-fills company and job title from the linked application.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit">Create session</Button>
          <Button type="button" variant="ghost" render={<Link href="/dashboard/interview-prep" />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
