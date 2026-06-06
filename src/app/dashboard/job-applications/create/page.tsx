import { redirect } from 'next/navigation'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>
}) {
  const { url } = await searchParams
  const params = new URLSearchParams({ create: '1' })
  if (url) params.set('url', url)
  redirect(`/dashboard/job-applications?${params.toString()}`)
}
