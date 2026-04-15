import { SidebarNav } from '@/components/layout/sidebar-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const initials = (user.user_metadata?.name as string || user.email || 'U')
    .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <SidebarNav />

      {/* Ações top-right: usuário + tema */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-1.5">
        <UserMenu
          name={user.user_metadata?.name || 'Usuário'}
          email={user.email || ''}
          initials={initials}
        />
        <ThemeToggle />
      </div>

      <div className="ml-[84px] min-h-screen">
        {children}
      </div>
    </div>
  );
}
