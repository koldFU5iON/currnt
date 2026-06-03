import { notFound } from "next/navigation"
import { requireProfile } from "@/lib/session"
import { getCV } from "@/modules/cv/queries"
import { CvEditor } from "./_components/cv-editor"

type Props = { params: Promise<{ id: string }> }

export default async function CVEditorPage({ params }: Props) {
  const { id } = await params
  const { profile } = await requireProfile()
  const cv = await getCV(id, profile.id)
  if (!cv) notFound()

  return <CvEditor cv={{ ...cv, profileName: cv.profile.name }} />
}
