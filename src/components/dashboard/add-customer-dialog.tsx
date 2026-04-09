"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Customer } from "@/lib/types";
import { upsertCustomer } from "@/app/(dashboard)/customers/actions";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  cnpj: z.string().optional(),
  ie: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  zipCode: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "", cnpj: "", ie: "",
  contactName: "", contactPhone: "", email: "",
  zipCode: "", addressStreet: "", addressNumber: "",
  addressComplement: "", neighborhood: "",
  city: "", state: "", category: "", notes: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer: Customer | null;
  onSaveSuccess: (customer: Customer) => void;
}

// ViaCEP lookup — returns logradouro, bairro, localidade, uf, ibge
async function fetchViaCep(cep: string) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.erro ? null : data as {
      logradouro: string; bairro: string;
      localidade: string; uf: string; ibge: string;
    };
  } catch {
    return null;
  }
}

export function AddCustomerDialog({ open, onOpenChange, editingCustomer, onSaveSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    if (editingCustomer) {
      form.reset({
        name: editingCustomer.name,
        cnpj: editingCustomer.cnpj ?? "",
        ie: editingCustomer.ie ?? "",
        contactName: editingCustomer.contactName ?? "",
        contactPhone: editingCustomer.contactPhone ?? "",
        email: editingCustomer.email ?? "",
        zipCode: editingCustomer.zipCode ?? "",
        addressStreet: editingCustomer.addressStreet ?? "",
        addressNumber: editingCustomer.addressNumber ?? "",
        addressComplement: editingCustomer.addressComplement ?? "",
        neighborhood: editingCustomer.neighborhood ?? "",
        city: editingCustomer.city ?? "",
        state: editingCustomer.state ?? "",
        category: editingCustomer.category ?? "",
        notes: editingCustomer.notes ?? "",
      });
    } else {
      form.reset(EMPTY);
    }
  }, [open, editingCustomer, form]);

  async function handleCepChange(value: string) {
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLoadingCep(true);
    const data = await fetchViaCep(clean);
    if (data) {
      form.setValue("addressStreet", data.logradouro ?? "");
      form.setValue("neighborhood", data.bairro ?? "");
      form.setValue("city", data.localidade ?? "");
      form.setValue("state", data.uf ?? "");
    }
    setLoadingCep(false);
  }

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const fd = new FormData();
    if (editingCustomer?.id) fd.append("id", editingCustomer.id);
    fd.append("name", values.name);
    fd.append("cnpj", values.cnpj ?? "");
    fd.append("ie", values.ie ?? "");
    fd.append("contactName", values.contactName ?? "");
    fd.append("contactPhone", values.contactPhone ?? "");
    fd.append("email", values.email ?? "");
    fd.append("zipCode", values.zipCode ?? "");
    fd.append("addressStreet", values.addressStreet ?? "");
    fd.append("addressNumber", values.addressNumber ?? "");
    fd.append("addressComplement", values.addressComplement ?? "");
    fd.append("neighborhood", values.neighborhood ?? "");
    fd.append("city", values.city ?? "");
    fd.append("state", values.state ?? "");
    fd.append("category", values.category ?? "");
    fd.append("notes", values.notes ?? "");

    const result = await upsertCustomer(fd);
    setLoading(false);
    if (result.success && result.customer) {
      onOpenChange(false);
      onSaveSuccess(result.customer);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{editingCustomer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ── Identificação ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Identificação</p>

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome / Razão Social *</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="Razão social ou nome" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="cnpj" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ / CPF</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="00.000.000/0001-00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="ie" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inscrição Estadual</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="000.000.000.000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="revendedor">Revendedor</SelectItem>
                      <SelectItem value="construtora">Construtora</SelectItem>
                      <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator className="border-zinc-700" />

            {/* ── Contato ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contato</p>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="contactName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Contato</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="Nome do contato" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="contactPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="(11) 99999-9999" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" className="bg-zinc-800 border-zinc-700" placeholder="contato@empresa.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator className="border-zinc-700" />

            {/* ── Endereço ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Endereço
                <span className="ml-2 font-normal normal-case text-zinc-500">— preencha o CEP para auto-completar</span>
              </p>

              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="zipCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          className="bg-zinc-800 border-zinc-700 pr-8"
                          placeholder="00000-000"
                          onChange={(e) => {
                            field.onChange(e);
                            handleCepChange(e.target.value);
                          }}
                        />
                        {loadingCep && (
                          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-zinc-400" />
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="col-span-2">
                  <FormField control={form.control} name="addressStreet" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="Rua, Av., Alameda..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="addressNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="123" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="col-span-2">
                  <FormField control={form.control} name="addressComplement" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="Sala, Andar, Bloco..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FormField control={form.control} name="neighborhood" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="Centro" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-zinc-800 border-zinc-700" placeholder="São Paulo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem className="w-24">
                  <FormLabel>UF</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="SP"
                      maxLength={2}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator className="border-zinc-700" />

            {/* ── Observações ── */}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={2}
                    className="bg-zinc-800 border-zinc-700 resize-none"
                    placeholder="Informações adicionais..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
