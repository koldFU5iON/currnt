import { AppSidebar } from '@/components/app-sidebar';
import { AppShell } from '@/components/shell/app-shell';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PageContextProvider } from '@/lib/context/page-context';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PageContextProvider>
          <AppShell>{children}</AppShell>
        </PageContextProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
