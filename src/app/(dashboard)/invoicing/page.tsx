'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  generateInvoice,
  type InvoiceOutput,
} from '@/ai/flows/intelligent-invoice-generator';
import { Bot, CheckCircle, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  customerLocation: z.string().min(1, 'Localização é obrigatória'),
  productType: z.string().min(1, 'Tipo de produto é obrigatório'),
  productDetails: z.string().min(1, 'Detalhes são obrigatórios'),
});

type FormValues = z.infer<typeof formSchema>;

export default function InvoicingPage() {
  const [results, setResults] = useState<InvoiceOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerLocation: 'São Paulo, SP',
      productType: 'Coifa Industrial',
      productDetails: 'Aço inox 304, 1mm, para restaurante',
    },
  });

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    setResults(null);
    try {
      const aiResponse = await generateInvoice(values);
      setResults(aiResponse);
      toast({
        title: 'Sucesso!',
        description: 'Detalhes fiscais gerados por IA.',
      });
    } catch (error) {
      console.error('AI invoice generation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao gerar detalhes fiscais. Por favor, tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const fiscalItems = [
    { label: 'NCM', value: results?.ncm },
    { label: 'CFOP', value: results?.cfop },
    { label: 'ICMS', value: results?.icms },
    { label: 'IPI', value: results?.ipi },
    { label: 'PIS/COFINS', value: results?.pisCofins },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Geração de Nota Fiscal</h1>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>Detalhes da Nota</CardTitle>
                <CardDescription>
                  Forneça os detalhes da transação para preencher automaticamente as informações fiscais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização do Cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: São Paulo, SP" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Produto</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um tipo de produto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Coifa Industrial">Coifa Industrial</SelectItem>
                          <SelectItem value="Grill Gourmet">Grill Gourmet</SelectItem>
                          <SelectItem value="Accessory">Acessório</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detalhes do Produto</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ex: Aço inox 304, 1mm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {isLoading ? 'Gerando...' : 'Gerar Dados Fiscais'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Checklist Fiscal</CardTitle>
            <CardDescription>
              Resultados do motor de regras fiscais com IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading &&
              fiscalItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ))}
            
            {!results && !isLoading && (
                 <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    <Bot className="mr-2 h-5 w-5" />
                    Os resultados aparecerão aqui.
                </div>
            )}

            {results && !isLoading && fiscalItems.map((item, index) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-code text-muted-foreground">{item.value || 'N/A'}</span>
                </div>
                {index < fiscalItems.length - 1 && <Separator className="my-3" />}
              </div>
            ))}
          </CardContent>
          <CardFooter>
             <Button disabled={!results || isLoading}>Emitir NF-e</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
