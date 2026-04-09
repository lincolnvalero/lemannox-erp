'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, ShieldCheck, Plus, Pencil, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUsers, createUser, updateUser, deleteUser, type AdminUser } from './actions';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  user: 'Usuário',
  viewer: 'Visualizador',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  user: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// ── Formulário base reutilizado em criar e editar ──────────────────────────────
function UserForm({
  values,
  onChange,
  showPassword,
  passwordLabel = 'Senha',
  emailDisabled = false,
}: {
  values: { name: string; email: string; role: string; password: string };
  onChange: (field: string, value: string) => void;
  showPassword: boolean;
  passwordLabel?: string;
  emailDisabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome completo</Label>
        <Input
          id="name"
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Ex.: João Silva"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail (login)</Label>
        <Input
          id="email"
          type="email"
          value={values.email}
          onChange={(e) => onChange('email', e.target.value)}
          placeholder="joao@empresa.com"
          disabled={emailDisabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Perfil de acesso</Label>
        <Select value={values.role} onValueChange={(v) => onChange('role', v)}>
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrador — acesso total</SelectItem>
            <SelectItem value="user">Usuário — acesso padrão</SelectItem>
            <SelectItem value="viewer">Visualizador — somente leitura</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showPassword && (
        <div className="space-y-1.5">
          <Label htmlFor="password">{passwordLabel}</Label>
          <div className="relative">
            <Input
              id="password"
              type={visible ? 'text' : 'password'}
              value={values.password}
              onChange={(e) => onChange('password', e.target.value)}
              placeholder={passwordLabel === 'Nova senha (deixe em branco para não alterar)' ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Wizard de novo usuário (2 etapas) ─────────────────────────────────────────
function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({ name: '', email: '', role: 'user', password: '' });

  const set = (field: string, value: string) => setValues((v) => ({ ...v, [field]: value }));

  const reset = () => { setValues({ name: '', email: '', role: 'user', password: '' }); setStep(1); };

  const handleClose = () => { reset(); onClose(); };

  const handleNext = () => {
    if (!values.name.trim() || !values.email.trim()) {
      toast({ variant: 'destructive', title: 'Preencha nome e e-mail' });
      return;
    }
    setStep(2);
  };

  const handleCreate = async () => {
    if (!values.password || values.password.length < 6) {
      toast({ variant: 'destructive', title: 'Senha deve ter pelo menos 6 caracteres' });
      return;
    }
    setSaving(true);
    const result = await createUser({
      email: values.email,
      password: values.password,
      name: values.name,
      role: values.role as AdminUser['role'],
    });
    setSaving(false);
    if (result.success) {
      toast({ title: 'Usuário criado com sucesso!' });
      handleClose();
      onCreated();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao criar usuário', description: result.error });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Novo Usuário — Etapa {step} de 2
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Dados do usuário e perfil de acesso' : 'Defina a senha de acesso'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <UserForm values={values} onChange={set} showPassword={false} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Nome:</span> {values.name}</p>
              <p><span className="text-muted-foreground">E-mail:</span> {values.email}</p>
              <p><span className="text-muted-foreground">Perfil:</span> {ROLE_LABELS[values.role]}</p>
            </div>
            <UserForm values={values} onChange={set} showPassword={true} passwordLabel="Senha de acesso" />
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleNext}>Próximo →</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>← Voltar</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog de edição ──────────────────────────────────────────────────────────
function EditUserDialog({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({ name: '', email: '', role: 'user', password: '' });

  useEffect(() => {
    if (user) setValues({ name: user.name, email: user.email, role: user.role, password: '' });
  }, [user]);

  const set = (field: string, value: string) => setValues((v) => ({ ...v, [field]: value }));

  const handleSave = async () => {
    if (!values.name.trim()) {
      toast({ variant: 'destructive', title: 'Nome é obrigatório' });
      return;
    }
    if (values.password && values.password.length < 6) {
      toast({ variant: 'destructive', title: 'Nova senha deve ter pelo menos 6 caracteres' });
      return;
    }
    setSaving(true);
    const result = await updateUser(user!.id, {
      name: values.name,
      email: values.email !== user!.email ? values.email : undefined,
      role: values.role as AdminUser['role'],
      password: values.password || undefined,
    });
    setSaving(false);
    if (result.success) {
      toast({ title: 'Usuário atualizado!' });
      onClose();
      onSaved();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: result.error });
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Editar Usuário
          </DialogTitle>
          <DialogDescription>Altere os dados, perfil ou senha do usuário.</DialogDescription>
        </DialogHeader>

        <UserForm
          values={values}
          onChange={set}
          showPassword={true}
          passwordLabel="Nova senha (deixe em branco para não alterar)"
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getUsers();
    if (result.success) setUsers(result.users ?? []);
    else toast({ variant: 'destructive', title: 'Erro ao carregar usuários', description: result.error });
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteUser(deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (result.success) {
      toast({ title: 'Usuário excluído' });
      load();
    } else {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: result.error });
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/80 px-4 backdrop-blur-sm md:px-8">
        <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Administração de Usuários</h1>
      </header>

      <main className="flex-1 space-y-6 p-4 md:p-8">
        {/* KPIs */}
        <div className="grid gap-4 grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total de usuários</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{loading ? '—' : users.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Administradores</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold text-purple-400">{loading ? '—' : adminCount}</p></CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários Cadastrados
                </CardTitle>
                <CardDescription>Gerencie perfis, permissões e senhas dos usuários</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Atualizar">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhum usuário cadastrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_COLOR[u.role] || ''}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            onClick={() => setEditUser(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />

      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={load}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário perderá acesso ao sistema imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
