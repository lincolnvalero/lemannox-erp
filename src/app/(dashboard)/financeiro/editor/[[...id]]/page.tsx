'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ChartOfAccount, FinancialTransaction } from '@/lib/types';
import { getTransaction, upsertTransaction, getAccounts } from '@/app/(dashboard)/financeiro/actions';
import { format as formatDate } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';


const formSchema = z.object({
  description: z.string().min(3, 'Descrição é obrigatória.'),
  amount: z.coerce.number().min(0.01, 'O valor deve ser maior que zero.'),
  type: z.enum(['entrada', 'saida'], { required_error: 'O tipo é obrigatório.'}),
  category: z.string().min(1, 'A categoria é obrigatória.'),
  transactionDate: z.string().min(1, 'A data da transação é obrigatória.'),
  status: z.enum(['pago', 'pendente']),
  dueDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function TransactionEditorPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [idLanc, setIdLanc] = useState<number | null>(null);

  const transactionId = params.id ? (params.id as string[])[0] : null;
  const isEditMode = !!transactionId;
  const initialType = searchParams.get('type') as 'entrada' | 'saida' | null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        description: '',
        amount: 0,
        type: initialType || 'saida',
        category: '',
        transactionDate: formatDate(new Date(), 'yyyy-MM-dd'),
        status: 'pago',
        dueDate: '',
    }
  });

  const { watch } = form;
  const watchedType = watch('type');
  const watchedStatus = watch('status');

  const categories = useMemo(() => accounts
    .filter(acc => acc.type === watchedType)
    .map(acc => acc.name)
    .sort(), [accounts, watchedType]);

  useEffect(() => {
    async function loadData() {
        setIsLoading(true);
        const accountsResult = await getAccounts();
        if (accountsResult.success) {
            setAccounts(accountsResult.accounts || []);
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as categorias.'});
        }

        if (isEditMode && transactionId) {
            const result = await getTransaction(transactionId);
            if (result.success && result.transaction) {
                const { transaction } = result;
                setIdLanc(transaction.idLanc || null);
                form.reset({
                    description: transaction.description,
                    amount: transaction.amount,
                    type: transaction.type,
                    category: transaction.category,
                    transactionDate: transaction.transactionDate.split('T')[0],
                    status: transaction.status,
                    dueDate: transaction.dueDate?.split('T')[0] || '',
                });
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: 'Transação não encontrada.'});
                router.push('/financeiro/historico');
            }
        } else {
            form.reset({
                description: '',
                amount: 0,
                type: initialType || 'saida',
                category: '',
                transactionDate: formatDate(new Date(), 'yyyy-MM-dd'),
                status: 'pago',
                dueDate: '',
            });
        }
        setIsLoading(false);
    }
    loadData();
  }, [transactionId, isEditMode, router, toast, form, initialType]);
  
  useEffect(() => {
    // Reset category if type changes
    form.setValue('category', '');
  }, [watchedType, form]);

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    const formData = new FormData();
    if (isEditMode && transactionId) {
        formData.append('id', transactionId);
    }
    formData.append('description', values.description);
    formData.append('amount', String(values.amount));
    formData.append('type', values.type);
    formData.append('category', values.category);
    formData.append('transactionDate', values.transactionDate);
    formData.append('status', values.status);
    if (values.dueDate) {
        formData.append('dueDate', values.dueDate);
    }

    const result = await upsertTransaction(formData);
    
    if (result.success) {
      toast({
        title: isEditMode ? 'Transação Atualizada!' : `Lançamento Adicionado!`,
      });
      router.push('/financeiro/historico');
      router.refresh();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao Salvar',
        description: result.error,
      });
    }
    setIsSaving(false);
  }

  if (isLoading) {
    return (
        <Card>
            <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
            <CardContent className="space-y-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                 <div className="flex justify-end gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? `Editar Lançamento #${idLanc}` : 'Nova Transação Financeira'}</CardTitle>
            <CardDescription>Preencha os detalhes para {isEditMode ? 'atualizar a' : 'criar uma nova'} transação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder={watchedType === 'entrada' ? 'Venda do Pedido #123' : 'Compra de parafusos'} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Valor (R$)</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="entrada">Receita (Entrada)</SelectItem>
                                    <SelectItem value="saida">Despesa (Saída)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="transactionDate"
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data da Transação</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione uma categoria..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <ScrollArea className="h-[200px]">
                        {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="pago">Pago</SelectItem>
                                <SelectItem value="pendente">Pendente</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {watchedStatus === 'pendente' && (
                    <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                           <FormItem>
                              <FormLabel>Data de Vencimento</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
             </div>
             <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
             </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
