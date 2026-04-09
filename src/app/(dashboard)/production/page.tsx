'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { FileDown, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

import {
  getProductionScheduleItems,
  updateProductionItemDate,
} from './actions';
import type { ScheduleItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportSchedulePdfDialog } from '@/components/dashboard/export-schedule-pdf-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function ProductionSchedulePage() {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<{[key: string]: boolean}>({});
  const [hideDelivered, setHideDelivered] = useState(true);

  const fetchSchedule = async () => {
    setLoading(true);
    const result = await getProductionScheduleItems();
    if (result.success) {
      setSchedule(result.items || []);
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar programação',
        description: result.error,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const filteredSchedule = useMemo(() => {
    if (hideDelivered) {
      return schedule.filter(item => !item.entregueEm);
    }
    return schedule;
  }, [schedule, hideDelivered]);

  const handleDateChange = async (
    item: ScheduleItem,
    status: 'concluidoEm' | 'entregueEm',
    date: string
  ) => {
    const key = `${item.quoteId}-${item.itemIndex}-${status}`;
    
    // Check if the date has actually changed
    const originalDate = item[status] ? new Date(item[status]!).toISOString().split('T')[0] : '';
    if (date === originalDate) {
        return; // No change, do nothing
    }

    setSavingStatus(prev => ({...prev, [key]: true}));
    
    // Optimistic update
    setSchedule((currentSchedule) =>
      currentSchedule.map((s) =>
        s.quoteId === item.quoteId && s.itemIndex === item.itemIndex
          ? { ...s, [status]: date ? new Date(date).toISOString() : null }
          : s
      )
    );

    const result = await updateProductionItemDate(
      item.quoteId,
      item.itemIndex,
      status,
      date ? new Date(date).toISOString() : null
    );

    setSavingStatus(prev => ({...prev, [key]: false}));

    if (!result.success) {
      toast({
        variant: 'destructive',
        title: `Erro ao atualizar data`,
        description: result.error,
      });
      // Revert on failure
      fetchSchedule();
    } else {
        toast({
            title: 'Status atualizado!',
            description: `Item do pedido #${item.pedido} foi atualizado.`
        })
    }
  };

  const formatDateForInput = (isoDate: string | null) => {
    if (!isoDate) return '';
    try {
      return new Date(isoDate).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  return (
    <>
      <ExportSchedulePdfDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        schedule={filteredSchedule}
      />
       <div className="flex-1 space-y-4 p-4 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Produção</h1>
        <Card>
            <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                <CardTitle>Programação da Produção</CardTitle>
                <CardDescription>
                    Acompanhe o status dos itens de orçamentos aprovados. As datas são salvas automaticamente.
                </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                <Button variant="outline" onClick={fetchSchedule} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
                <Button onClick={() => setIsExportDialogOpen(true)} disabled={filteredSchedule.length === 0}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Exportar PDF
                </Button>
                </div>
            </div>
            <div className="flex items-center justify-start gap-4 pt-4 border-t mt-4">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="hide-delivered"
                        checked={hideDelivered}
                        onCheckedChange={(checked) => setHideDelivered(checked === true)}
                    />
                    <Label htmlFor="hide-delivered">
                        Ocultar itens entregues
                    </Label>
                </div>
            </div>
            </CardHeader>
            <CardContent>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3 px-2 text-left font-medium whitespace-nowrap w-[64px]">Pedido</th>
                    <th className="py-3 px-2 text-left font-medium whitespace-nowrap w-[52px]">OS</th>
                    <th className="py-3 px-2 text-left font-medium whitespace-nowrap w-[88px]">Data</th>
                    <th className="py-3 px-2 text-left font-medium min-w-[140px]">Cliente</th>
                    <th className="py-3 px-2 text-left font-medium min-w-[80px] max-w-[120px]">Obra</th>
                    <th className="py-3 px-2 text-left font-medium min-w-[180px]">Produto</th>
                    <th className="py-3 px-2 text-left font-medium whitespace-nowrap w-[80px]">Previsão</th>
                    <th className="py-3 px-2 text-center font-medium whitespace-nowrap w-[116px]">Concluído em</th>
                    <th className="py-3 px-2 text-center font-medium whitespace-nowrap w-[116px]">Entregue em</th>
                </tr>
                </thead>
                <tbody>
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                        <td className="py-3 px-2"><Skeleton className="h-4 w-12" /></td>
                        <td className="py-3 px-2"><Skeleton className="h-4 w-10" /></td>
                        <td className="py-3 px-2"><Skeleton className="h-4 w-20" /></td>
                        <td className="py-3 px-2"><Skeleton className="h-4 w-36" /></td>
                        <td className="py-3 px-2"><Skeleton className="h-4 w-20" /></td>
                        <td className="py-3 px-2"><Skeleton className="h-4 w-44" /></td>
                        <td className="py-3 px-2"><Skeleton className="h-4 w-16" /></td>
                        <td className="py-3 px-2"><Skeleton className="h-8 w-[100px] mx-auto" /></td>
                        <td className="py-3 px-2"><Skeleton className="h-8 w-[100px] mx-auto" /></td>
                    </tr>
                    ))
                ) : filteredSchedule.length > 0 ? (
                    filteredSchedule.map((item) => {
                    const concluidoKey = `${item.quoteId}-${item.itemIndex}-concluidoEm`;
                    const entregueKey = `${item.quoteId}-${item.itemIndex}-entregueEm`;
                    const isSavingConcluido = savingStatus[concluidoKey];
                    const isSavingEntregue = savingStatus[entregueKey];
                    const isDelivered = !!item.entregueEm;

                    return (
                        <tr
                        key={`${item.quoteId}-${item.itemIndex}`}
                        className={`border-b border-border/50 transition-opacity hover:bg-muted/30 ${
                            isSavingConcluido || isSavingEntregue ? 'opacity-40' : ''
                        } ${isDelivered ? 'opacity-60' : ''}`}
                        >
                        <td className="py-2.5 px-2 font-mono text-xs font-medium text-muted-foreground whitespace-nowrap">
                            #{item.pedido}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-xs font-medium whitespace-nowrap">
                            {item.osNumber || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(item.data), 'dd/MM/yy')}
                        </td>
                        <td className="py-2.5 px-2 text-sm font-medium leading-tight">
                            {item.cliente}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground max-w-[120px] truncate" title={item.obra}>
                            {item.obra || <span>—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-sm leading-tight">
                            {item.produto}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                            {item.previsao || <span>—</span>}
                        </td>
                        <td className="py-2.5 px-2">
                            <Input
                            type="date"
                            className="h-7 text-xs px-2 w-[100px] mx-auto"
                            defaultValue={formatDateForInput(item.concluidoEm)}
                            onBlur={(e) => handleDateChange(item, 'concluidoEm', e.target.value)}
                            disabled={isSavingConcluido || isSavingEntregue}
                            />
                        </td>
                        <td className="py-2.5 px-2">
                            <Input
                            type="date"
                            className="h-7 text-xs px-2 w-[100px] mx-auto"
                            defaultValue={formatDateForInput(item.entregueEm)}
                            onBlur={(e) => handleDateChange(item, 'entregueEm', e.target.value)}
                            disabled={isSavingConcluido || isSavingEntregue}
                            />
                        </td>
                        </tr>
                    );
                    })
                ) : (
                    <tr>
                    <td colSpan={9} className="h-24 text-center text-muted-foreground">
                        {schedule.length > 0 ? 'Nenhum item corresponde aos filtros.' : 'Nenhum item na programação de produção.'}
                    </td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
            </CardContent>
        </Card>
      </div>
    </>
  );
}
