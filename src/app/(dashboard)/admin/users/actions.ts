'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: string;
};

export async function getUsers(): Promise<{ success: boolean; users?: AdminUser[]; error?: string }> {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      users: (data ?? []).map((u: Record<string, unknown>) => ({
        id: u.id as string,
        email: u.email as string,
        name: (u.name as string) || '',
        role: (u.role as AdminUser['role']) || 'viewer',
        createdAt: u.created_at as string,
      })),
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao buscar usuários' };
  }
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: AdminUser['role'];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = adminClient();

    // Cria o usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });

    if (authError) throw authError;

    const userId = authData.user.id;
    const initials = data.name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();

    // Upsert no perfil (o trigger já cria, mas garante os dados corretos)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: data.email,
        name: data.name,
        role: data.role,
      });

    if (profileError) throw profileError;

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao criar usuário' };
  }
}

export async function updateUser(
  id: string,
  data: { name?: string; email?: string; role?: AdminUser['role']; password?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = adminClient();

    // Atualiza Auth (email e/ou senha)
    const authUpdate: Record<string, unknown> = {};
    if (data.email) authUpdate.email = data.email;
    if (data.password) authUpdate.password = data.password;

    if (Object.keys(authUpdate).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdate);
      if (authError) throw authError;
    }

    // Atualiza perfil
    const profileUpdate: Record<string, unknown> = {};
    if (data.name !== undefined) profileUpdate.name = data.name;
    if (data.email) profileUpdate.email = data.email;
    if (data.role) profileUpdate.role = data.role;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', id);
      if (profileError) throw profileError;
    }

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao atualizar usuário' };
  }
}

export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = adminClient();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao excluir usuário' };
  }
}
