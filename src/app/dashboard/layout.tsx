import { AppSidebar } from '@/components/app-sidebar';
import { AppShell } from '@/components/shell/app-shell';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PageContextProvider } from '@/lib/context/page-context';
import { requireProfile } from '@/lib/session';
import { getActiveJobsForNav } from '@/modules/jobs/queries';
import { getSuggestionCount } from '@/modules/search-profile/queries';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile()
  const [activeJobs, suggestionCount] = await Promise.all([
    getActiveJobsForNav(profile.id),
    getSuggestionCount(profile.id),
  ])

  return (
    <SidebarProvider>
      <PageContextProvider>
        <AppSidebar activeJobs={activeJobs} suggestionCount={suggestionCount} />
        <SidebarInset>
          <AppShell>{children}</AppShell>
        </SidebarInset>
      </PageContextProvider>
    </SidebarProvider>
  );
}
