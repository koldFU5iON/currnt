import { getJobApplicationById } from "@/modules/jobs/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Link as LinkIcon } from "lucide-react";
import Link from "next/link";

export default async function ViewJobPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const job = await getJobApplicationById(id);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Job not found</h1>
          <p className="text-muted-foreground mb-4">The job application you're looking for doesn't exist.</p>
          <Link href="/dashboard/job-applications">
            <Button>Back to applications</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Ensure dates are Date objects
  const dateApplied = job.dateApplied ? new Date(job.dateApplied) : null;
  const lastUpdated = job.lastUpdated ? new Date(job.lastUpdated) : null;
  const countries = Array.isArray(job.countries) ? job.countries : [];
  const tags = Array.isArray(job.tags) ? job.tags : [];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Link href="/dashboard/job-applications" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to applications
          </Link>
          <h1 className="text-4xl font-bold">{job.title}</h1>
          <p className="text-xl text-muted-foreground">{job.company}</p>
        </div>

        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="capitalize">{job.status}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-sm capitalize">{job.progress}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Applied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-sm">{dateApplied?.toLocaleDateString() || 'Not set'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Updated</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-sm">{lastUpdated?.toLocaleDateString() || 'Not set'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.jobNumber && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Job Number</h3>
                <p>{job.jobNumber}</p>
              </div>
            )}

            {countries.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Locations</h3>
                <div className="flex flex-wrap gap-2">
                  {countries.map((country) => (
                    <Badge key={country} variant="secondary">
                      <MapPin className="w-3 h-3 mr-1" />
                      {country}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {job.url && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Job URL</h3>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="w-4 h-4" />
                  {job.url}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job Description */}
        {job.jobDescription && (
          <Card>
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{job.jobDescription}</p>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
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

        {/* Tags */}
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
      </div>
    </div>
  );
}
