import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { APPLICATION_SOURCE_LABEL, type Job } from "@/app/types/job-application"
import { MapPin } from "lucide-react"
import { MarkdownProse } from "./markdown-prose"

export function JobDetailsCard({ job }: { job: Job }) {
  const countries = Array.isArray(job.countries) ? job.countries : []
  const tags = Array.isArray(job.tags) ? job.tags : []
  // Source is always set (DB default 'cold'), so it's always part of the metadata row.
  const hasMetadata = countries.length > 0 || !!job.jobNumber || tags.length > 0 || !!job.applicationSource

  return (
    <div className="space-y-8">
      {hasMetadata && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-x-8 gap-y-5 pt-5 sm:grid-cols-2 md:grid-cols-3">
            {job.jobNumber && (
              <MetaField label="Reference">
                <span className="font-mono text-sm">{job.jobNumber}</span>
              </MetaField>
            )}
            <MetaField label="Source">
              <span className="text-sm">{APPLICATION_SOURCE_LABEL[job.applicationSource]}</span>
            </MetaField>
            {countries.length > 0 && (
              <MetaField label="Locations">
                <div className="flex flex-wrap gap-1.5">
                  {countries.map((country) => (
                    <Badge key={country} variant="secondary" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {country}
                    </Badge>
                  ))}
                </div>
              </MetaField>
            )}
            {tags.length > 0 && (
              <MetaField label="Tags">
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </MetaField>
            )}
          </CardContent>
        </Card>
      )}

      {job.jobDescription && (
        <section aria-labelledby="desc-heading">
          <h2 id="desc-heading" className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Job Description
          </h2>
          <MarkdownProse content={job.jobDescription} />
        </section>
      )}

      {job.notes && (
        <section aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{job.notes}</p>
        </section>
      )}
    </div>
  )
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
