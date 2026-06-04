import { SidebarNav } from '@/components/layout/sidebar-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { RoleProvider, type AppRole } from '@/lib/role-context';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // DB aceita: 'admin' | 'user' | 'viewer'. Qualquer coisa ≠ admin = producao
  const role: AppRole = profile?.role === 'admin' ? 'admin' : 'producao';

  const initials = (user.user_metadata?.name as string || user.email || 'U')
    .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();

  return (
    <RoleProvider role={role}>
      <div className="min-h-screen bg-background">
        <SidebarNav
          role={role}
          footer={
            <>
              <UserMenu
                name={user.user_metadata?.name || 'Usuário'}
                email={user.email || ''}
                initials={initials}
              />
              <ThemeToggle />
            </>
          }
        />

        {/* Mobile: pt-14 para compensar o top bar fixo. Desktop: ml-[84px] para o rail. */}
        <div className="md:ml-[84px] pt-14 md:pt-0 min-h-screen">
          {children}
        </div>
      </div>
    </RoleProvider>
  );
}
