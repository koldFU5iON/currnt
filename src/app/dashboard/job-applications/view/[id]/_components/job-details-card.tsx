import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type Job } from "@/app/types/job-application"
import { Link as LinkIcon, MapPin } from "lucide-react"

export function JobDetailsCard({ job }: { job: Job }) {
  const countries = Array.isArray(job.countries) ? job.countries : []
  const tags = Array.isArray(job.tags) ? job.tags : []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.jobNumber && (
            <DetailRow label="Job Number">
              <p>{job.jobNumber}</p>
            </DetailRow>
          )}

          {countries.length > 0 && (
            <DetailRow label="Locations">
              <div className="flex flex-wrap gap-2">
                {countries.map((country) => (
                  <Badge key={country} variant="secondary">
                    <MapPin className="w-3 h-3 mr-1" />
                    {country}
                  </Badge>
                ))}
              </div>
            </DetailRow>
          )}

          {job.url && (
            <DetailRow label="Job URL">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline flex items-center gap-1"
              >
                <LinkIcon className="w-4 h-4" />
                {job.url}
              </a>
            </DetailRow>
          )}
        </CardContent>
      </Card>

      {job.jobDescription && (
        <Card>
          <CardHeader>
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {job.jobDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {job.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{job.notes}</p>
          </CardContent>
        </Card>
      )}

      {tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{label}</h3>
      {children}
    </div>
  )
}
