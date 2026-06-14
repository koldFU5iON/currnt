import { AppSidebar } from '@/components/app-sidebar';
import { AppShell } from '@/components/shell/app-shell';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PageContextProvider } from '@/lib/context/page-context';
import { requireProfile } from '@/lib/session';
import { getActiveJobsForNav } from '@/modules/jobs/queries';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile()
  const activeJobs = await getActiveJobsForNav(profile.id)

  return (
    <SidebarProvider>
      <PageContextProvider>
        <AppSidebar activeJobs={activeJobs} />
        <SidebarInset>
          <AppShell>{children}</AppShell>
        </SidebarInset>
      </PageContextProvider>
    </SidebarProvider>
  );
}
