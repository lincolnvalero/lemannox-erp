
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FilePenLine, PlusCircle, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { ChartOfAccount } from '@/lib/types';
import { getAccounts, deleteAccount } from '../actions';
import { AccountFormDialog } from '@/components/dashboard/account-form-dialog';

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<ChartOfAccount | null>(null);
  const { toast } = useToast();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const result = await getAccounts();
    if (result.success) {
      setAccounts(result.accounts || []);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao Carregar Contas',
        description: result.error,
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);
  
  const handleDialogClose = (refresh?: boolean) => {
    setIsDialogOpen(false);
    if (refresh) {
      fetchAccounts();
    }
  };
  
  const handleSaveSuccess = (savedAccount: ChartOfAccount) => {
    setAccounts(currentAccounts => {
      const index = currentAccounts.findIndex(a => a.id === savedAccount.id);
      let newAccounts;
      if (index !== -1) {
        newAccounts = [...currentAccounts];
        newAccounts[index] = savedAccount;
      } else {
        newAccounts = [...currentAccounts, savedAccount];
      }
      return newAccounts.sort((a,b) => a.name.localeCompare(b.name));
    });
  };
  
  const handleAddNew = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };
  
  const handleEdit = (account: ChartOfAccount) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;
    const result = await deleteAccount(accountToDelete.id);
    if (result.success) {
      toast({
        title: 'Conta Excluída',
        description: `A conta "${accountToDelete.name}" foi removida.`,
      });
      setAccounts(prev => prev.filter(a => a.id !== accountToDelete.id));
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao Excluir',
        description: result.error,
      });
    }
    setAccountToDelete(null);
  };

  const { revenueAccounts, expenseAccounts } = useMemo(() => {
    return accounts.reduce(
      (acc, account) => {
        if (account.type === 'entrada') {
          acc.revenueAccounts.push(account);
        } else {
          acc.expenseAccounts.push(account);
        }
        return acc;
      },
      { revenueAccounts: [] as ChartOfAccount[], expenseAccounts: [] as ChartOfAccount[] }
    );
  }, [accounts]);
  
  const AccountTable = ({
    accounts,
    loading,
  }: {
    accounts: ChartOfAccount[];
    loading: boolean;
  }) => (
     <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome da Conta</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-5 w-48" /></TableCell>
              <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
            </TableRow>
          ))
        ) : accounts.length > 0 ? (
          accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">{account.name}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(account)}>
                    <FilePenLine className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setAccountToDelete(account)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Excluir</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={2} className="h-24 text-center">Nenhuma conta encontrada.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <>
      <AccountFormDialog 
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        onSaveSuccess={handleSaveSuccess}
        editingAccount={editingAccount}
      />
      <AlertDialog
        open={!!accountToDelete}
        onOpenChange={() => setAccountToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá excluir permanentemente a conta &quot;{accountToDelete?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Contas de Receita (Entradas)</CardTitle>
                <CardDescription>Contas que representam entrada de dinheiro.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova Conta
            </Button>
          </CardHeader>
          <CardContent>
            <AccountTable accounts={revenueAccounts} loading={loading} />
          </CardContent>
        </Card>
        
         <Card>
          <CardHeader className="flex flex-row items-center justify-between">
             <div>
                <CardTitle>Contas de Despesa (Saídas)</CardTitle>
                <CardDescription>Contas que representam saída de dinheiro.</CardDescription>
            </div>
             <Button size="sm" variant="outline" onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova Conta
            </Button>
          </CardHeader>
          <CardContent>
             <AccountTable accounts={expenseAccounts} loading={loading} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
