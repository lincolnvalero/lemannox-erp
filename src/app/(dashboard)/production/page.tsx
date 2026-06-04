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
import { Input } from '@/components/ui/input';
import { FileDown, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

import {
  getProductionScheduleItems,
  updateProductionItemDate,
} from './actions';
import { getQuote } from '../quotes/actions';
import type { ScheduleItem, Quote } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportSchedulePdfDialog } from '@/components/dashboard/export-schedule-pdf-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { QuotePreview } from '@/components/dashboard/quote-preview';

export default function ProductionSchedulePage() {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<{[key: string]: boolean}>({});
  const [hideDelivered, setHideDelivered] = useState(true);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSchedule = useMemo(() => {
    const items = hideDelivered ? schedule.filter(item => !item.entregueEm) : schedule;
    return [...items].sort((a, b) => {
      if (!a.previsao && !b.previsao) return 0;
      if (!a.previsao) return 1;
      if (!b.previsao) return -1;
      return new Date(a.previsao).getTime() - new Date(b.previsao).getTime();
    });
  }, [schedule, hideDelivered]);

  const handleDateChange = async (
    item: ScheduleItem,
    status: 'concluidoEm' | 'entregueEm',
    date: string
  ) => {
    const key = `${item.quoteId}-${item.itemIndex}-${status}`;

    const originalDate = item[status] ? new Date(item[status]!).toISOString().split('T')[0] : '';
    if (date === originalDate) return;

    setSavingStatus(prev => ({...prev, [key]: true}));

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
      fetchSchedule();
    } else {
      toast({
        title: 'Status atualizado!',
        description: `Item do pedido #${item.pedido} foi atualizado.`
      });
    }
  };

  const handleOpenPreview = async (quoteId: string) => {
    setLoadingPreview(true);
    const result = await getQuote(quoteId);
    if (result.success && result.quote) {
      setPreviewQuote(result.quote);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao carregar orçamento', description: result.error });
    }
    setLoadingPreview(false);
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
      <Dialog open={!!previewQuote} onOpenChange={(open) => { if (!open) setPreviewQuote(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {previewQuote && <QuotePreview quote={previewQuote} />}
        </DialogContent>
      </Dialog>

      <ExportSchedulePdfDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        schedule={filteredSchedule}
      />
      <div className="flex-1 space-y-4 p-3 md:p-8">
        <h1 className="hidden md:block text-2xl font-bold tracking-tight">Produção</h1>

        <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Programação da Produção</CardTitle>
                    <CardDescription className="hidden md:block">
                      Acompanhe o status dos itens de orçamentos aprovados. As datas são salvas automaticamente.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchSchedule} disabled={loading}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={() => setIsExportDialogOpen(true)} disabled={filteredSchedule.length === 0}>
                      <FileDown className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Exportar PDF</span>
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-3 border-t mt-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hide-delivered"
                      checked={hideDelivered}
                      onCheckedChange={(checked) => setHideDelivered(checked === true)}
                    />
                    <Label htmlFor="hide-delivered" className="text-sm">
                      Ocultar itens entregues
                    </Label>
                  </div>
                  {!loading && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {filteredSchedule.length} item{filteredSchedule.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {/* MOBILE: Card list */}
                <div className="md:hidden space-y-2">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="rounded-xl border bg-card/50 p-4 space-y-2">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-56" />
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      </div>
                    ))
                  ) : filteredSchedule.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      {schedule.length > 0 ? 'Nenhum item corresponde aos filtros.' : 'Nenhum item na programação de produção.'}
                    </div>
                  ) : filteredSchedule.map((item) => {
                    const concluidoKey = `${item.quoteId}-${item.itemIndex}-concluidoEm`;
                    const entregueKey = `${item.quoteId}-${item.itemIndex}-entregueEm`;
                    const isSaving = savingStatus[concluidoKey] || savingStatus[entregueKey];
                    const isDelivered = !!item.entregueEm;

                    return (
                      <div
                        key={`${item.quoteId}-${item.itemIndex}`}
                        className={`rounded-xl border bg-card px-4 py-3 transition-opacity ${isSaving ? 'opacity-40' : ''} ${isDelivered ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={() => handleOpenPreview(item.quoteId)} disabled={loadingPreview} className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline disabled:opacity-50">#{item.pedido}</button>
                              {item.osNumber && (
                                <span className="font-mono text-xs font-medium">OS {item.osNumber}</span>
                              )}
                              <span className="text-xs text-muted-foreground">{format(new Date(item.data), 'dd/MM/yy')}</span>
                            </div>
                            <p className="font-semibold text-sm mt-0.5">{item.cliente}</p>
                            {item.obra && <p className="text-xs text-muted-foreground">{item.obra}</p>}
                            <p className="text-xs mt-1 leading-snug">{item.produto}</p>
                          </div>
                          {item.previsao && (
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-muted-foreground">Previsão</p>
                              <p className="text-xs font-semibold">{format(new Date(item.previsao), 'dd/MM/yy')}</p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Concluído em</p>
                            <Input
                              type="date"
                              className="h-8 text-xs px-2"
                              defaultValue={formatDateForInput(item.concluidoEm)}
                              onBlur={(e) => handleDateChange(item, 'concluidoEm', e.target.value)}
                              disabled={isSaving}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Entregue em</p>
                            <Input
                              type="date"
                              className="h-8 text-xs px-2"
                              defaultValue={formatDateForInput(item.entregueEm)}
                              onBlur={(e) => handleDateChange(item, 'entregueEm', e.target.value)}
                              disabled={isSaving}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP: Table */}
                <div className="hidden md:block overflow-x-auto">
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
                              className={`border-b border-border/50 transition-opacity hover:bg-muted/30 ${isSavingConcluido || isSavingEntregue ? 'opacity-40' : ''} ${isDelivered ? 'opacity-60' : ''}`}
                            >
                              <td className="py-2.5 px-2 font-mono text-xs font-medium text-muted-foreground whitespace-nowrap">
                                <button onClick={() => handleOpenPreview(item.quoteId)} disabled={loadingPreview} className="hover:text-primary hover:underline disabled:opacity-50">#{item.pedido}</button>
                              </td>
                              <td className="py-2.5 px-2 font-mono text-xs font-medium whitespace-nowrap">
                                {item.osNumber || <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(item.data), 'dd/MM/yy')}</td>
                              <td className="py-2.5 px-2 text-sm font-medium leading-tight">{item.cliente}</td>
                              <td className="py-2.5 px-2 text-xs text-muted-foreground max-w-[120px] truncate" title={item.obra}>{item.obra || <span>—</span>}</td>
                              <td className="py-2.5 px-2 text-sm leading-tight">{item.produto}</td>
                              <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                                {item.previsao ? format(new Date(item.previsao), 'dd/MM/yyyy') : <span>—</span>}
                              </td>
                              <td className="py-2.5 px-2">
                                <Input type="date" className="h-7 text-xs px-2 w-[100px] mx-auto"
                                  defaultValue={formatDateForInput(item.concluidoEm)}
                                  onBlur={(e) => handleDateChange(item, 'concluidoEm', e.target.value)}
                                  disabled={isSavingConcluido || isSavingEntregue}
                                />
                              </td>
                              <td className="py-2.5 px-2">
                                <Input type="date" className="h-7 text-xs px-2 w-[100px] mx-auto"
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
