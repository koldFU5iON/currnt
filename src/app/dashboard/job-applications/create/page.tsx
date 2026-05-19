import { CreateJobForm } from "@/app/components/create-job/CreateJobForm";

export default function Page() {
  return (
    <div>
      <h1>
        Create New Job Application Form
      </h1>
      <div className="rounded-2xl bg-gray-300 border p-4 mx-3 my-2 w-2xl">
        <CreateJobForm />
      </div>
    </div>)
}
