import { CreateJobForm } from "./_components/create-job-form";

export default function Page() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Create New Job Application</h1>
      <div className="rounded-2xl bg-muted border p-6 w-full max-w-2xl">
        <CreateJobForm />
      </div>
    </div>
  )
}
