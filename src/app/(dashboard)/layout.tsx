import { SidebarNav } from '@/components/layout/sidebar-nav';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-background">
      <SidebarNav user={user} />
      <div className="ml-[68px] min-h-screen">
        {children}
      </div>
    </div>
  );
}
