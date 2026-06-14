import { MarkdownProse } from "@/components/ui/markdown-prose"

interface Props {
  jobDescription: string | null | undefined
}

export function JobDescriptionPane({ jobDescription }: Props) {
  return (
    <div className="flex flex-col overflow-hidden border-r">
      {/* Sticky header */}
      <div className="shrink-0 border-b bg-background px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Job Description
        </h2>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {jobDescription?.trim() ? (
          <MarkdownProse content={jobDescription} />
        ) : (
          <p className="text-sm text-muted-foreground">No job description added yet.</p>
        )}
      </div>
    </div>
  )
}
