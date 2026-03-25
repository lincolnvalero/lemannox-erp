'use server';
import { revalidatePath } from 'next/cache';
import * as admin from 'firebase-admin';
import { firestore, auth } from '@/firebase/server';
import type { User } from '@/lib/types';

export type GetUsersResult = {
  success: boolean;
  users?: User[];
  error?: string;
};

// Helper function to get user profile from Firestore
async function getUserProfile(uid: string): Promise<Partial<User>> {
  const userDoc = await firestore.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return {};
  }
  const data = userDoc.data();
  return {
    name: data?.name,
    role: data?.role,
    phone: data?.phone,
  };
}

export async function getUsers(): Promise<GetUsersResult> {
    try {
        const [listUsersResult, usersSnapshot] = await Promise.all([
            auth.listUsers(),
            firestore.collection('users').get(),
        ]);

        const profilesByUid: Record<string, Partial<User>> = {};
        usersSnapshot.forEach((doc) => {
            profilesByUid[doc.id] = doc.data() as Partial<User>;
        });

        const users: User[] = listUsersResult.users.map((userRecord) => {
            const profile = profilesByUid[userRecord.uid] || {};
            return {
                uid: userRecord.uid,
                name: profile.name || userRecord.displayName || 'N/A',
                email: userRecord.email || 'N/A',
                role: profile.role || 'User',
                phone: profile.phone || 'N/A',
                disabled: userRecord.disabled,
            };
        });

        return { success: true, users: users };
    } catch (error: any) {
        console.error('Error getting users:', error);
        let errorMessage = 'Não foi possível carregar a lista de usuários.';
        if (error.message?.includes('Cloud Firestore API has not been used')) {
            errorMessage = 'A API do Cloud Firestore precisa ser ativada. Por favor, ative-a no console do Google Cloud e tente novamente.';
        }
        return { success: false, error: errorMessage };
    }
}


type UpsertUserResult = {
  success: boolean;
  error?: string;
};

export async function upsertUser(formData: FormData): Promise<UpsertUserResult> {
  const uid = formData.get('uid') as string | null;
  const email = formData.get('email') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as 'Admin' | 'User';
  const phone = formData.get('phone') as string;
  let password = formData.get('password') as string | null;

  try {
    const profileData = { name, role, phone, email };

    if (uid) {
      // Editing an existing user
      const authUpdatePayload: admin.auth.UpdateRequest = {
        email: email,
        displayName: name,
      };
      if (password) {
        authUpdatePayload.password = password;
      }
      await auth.updateUser(uid, authUpdatePayload);
      await firestore.collection('users').doc(uid).update(profileData);
    } else {
      // Creating a new user
      if (!password) {
        return { success: false, error: 'A senha é obrigatória para novos usuários.' };
      }
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });
      await firestore.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        ...profileData,
        disabled: false,
      });
    }

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: any) {
    console.error('Error upserting user:', error);
    let errorMessage = 'Ocorreu um erro desconhecido.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Este e-mail já está em uso.';
    } else if (error.code === 'auth/invalid-password') {
        errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
    } else if (error.message?.includes('Cloud Firestore API has not been used')) {
        errorMessage = 'A API do Cloud Firestore precisa ser ativada. Por favor, ative-a no console do Google Cloud e tente novamente.';
    }
    return { success: false, error: errorMessage };
  }
}

export async function deleteUser(uid: string): Promise<UpsertUserResult> {
  try {
    // Disable in Auth
    await auth.updateUser(uid, { disabled: true });
    // Mark as disabled in Firestore (soft delete)
    await firestore.collection('users').doc(uid).update({ disabled: true });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    let errorMessage = 'Falha ao desativar o usuário.';
     if (error.message?.includes('Cloud Firestore API has not been used')) {
        errorMessage = 'A API do Cloud Firestore precisa ser ativada. Por favor, ative-a no console do Google Cloud e tente novamente.';
    }
    return { success: false, error: errorMessage };
  }
}

export async function toggleUserStatus(uid: string, currentStatus: boolean): Promise<UpsertUserResult> {
    try {
        const newStatus = !currentStatus;
        await auth.updateUser(uid, { disabled: newStatus });
        await firestore.collection('users').doc(uid).update({ disabled: newStatus });

        revalidatePath('/admin/users');
        return { success: true };
    } catch(error: any) {
        console.error('Error toggling user status:', error);
        let errorMessage = 'Falha ao alterar o status do usuário.';
        if (error.message?.includes('Cloud Firestore API has not been used')) {
            errorMessage = 'A API do Cloud Firestore precisa ser ativada. Por favor, ative-a no console do Google Cloud e tente novamente.';
        }
        return { success: false, error: errorMessage };
    }
}
