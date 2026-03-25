"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Customer } from "@/lib/types";
import { upsertCustomer } from "@/app/(dashboard)/customers/actions";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  cnpj: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer: Customer | null;
  onSaveSuccess: (customer: Customer) => void;
}

export function AddCustomerDialog({
  open,
  onOpenChange,
  editingCustomer,
  onSaveSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      cnpj: "",
      contactName: "",
      contactPhone: "",
      email: "",
      city: "",
      state: "",
      category: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    if (editingCustomer) {
      form.reset({
        name: editingCustomer.name,
        cnpj: editingCustomer.cnpj ?? "",
        contactName: editingCustomer.contactName ?? "",
        contactPhone: editingCustomer.contactPhone ?? "",
        email: editingCustomer.email ?? "",
        city: editingCustomer.city ?? "",
        state: editingCustomer.state ?? "",
        category: editingCustomer.category ?? "",
        notes: editingCustomer.notes ?? "",
      });
    } else {
      form.reset({
        name: "",
        cnpj: "",
        contactName: "",
        contactPhone: "",
        email: "",
        city: "",
        state: "",
        category: "",
        notes: "",
      });
    }
  }, [open, editingCustomer, form]);

  async function onSubmit(values: FormValues) {
    setLoading(true);

    const fd = new FormData();
    if (editingCustomer?.id) fd.append("id", editingCustomer.id);
    fd.append("name", values.name);
    fd.append("cnpj", values.cnpj ?? "");
    fd.append("contactName", values.contactName ?? "");
    fd.append("contactPhone", values.contactPhone ?? "");
    fd.append("email", values.email ?? "");
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
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{editingCustomer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="Razão social ou nome"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ / CPF</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="00.000.000/0001-00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
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
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="Nome do contato"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="(00) 00000-0000"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="contato@empresa.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-zinc-800 border-zinc-700"
                          placeholder="São Paulo"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="SP"
                        maxLength={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      className="bg-zinc-800 border-zinc-700 resize-none"
                      placeholder="Informações adicionais..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-zinc-400"
              >
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
