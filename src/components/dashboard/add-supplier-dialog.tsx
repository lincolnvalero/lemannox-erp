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
import { Button } from "@/components/ui/button";
import { Supplier } from "@/lib/types";
import { upsertSupplier } from "@/app/(dashboard)/suppliers/actions";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  cnpj: z.string().optional(),
  category: z.string().min(1, "Categoria obrigatória"),
  contactName: z.string().min(1, "Contato obrigatório"),
  phone: z.string().min(1, "Telefone obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSupplier: Supplier | null;
  onSaveSuccess: () => void;
}

export function AddSupplierDialog({
  open,
  onOpenChange,
  editingSupplier,
  onSaveSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      cnpj: "",
      category: "",
      contactName: "",
      phone: "",
      email: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    if (editingSupplier) {
      form.reset({
        name: editingSupplier.name,
        cnpj: editingSupplier.cnpj ?? "",
        category: editingSupplier.category,
        contactName: editingSupplier.contactName,
        phone: editingSupplier.phone,
        email: editingSupplier.email ?? "",
      });
    } else {
      form.reset({
        name: "",
        cnpj: "",
        category: "",
        contactName: "",
        phone: "",
        email: "",
      });
    }
  }, [open, editingSupplier, form]);

  async function onSubmit(values: FormValues) {
    setLoading(true);

    const fd = new FormData();
    if (editingSupplier?.id) fd.append("id", editingSupplier.id);
    fd.append("name", values.name);
    fd.append("cnpj", values.cnpj ?? "");
    fd.append("category", values.category);
    fd.append("contactName", values.contactName);
    fd.append("phone", values.phone);
    fd.append("email", values.email ?? "");

    const result = await upsertSupplier(fd);

    setLoading(false);

    if (result.success) {
      onOpenChange(false);
      onSaveSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>
            {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
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
                      placeholder="Razão social"
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
                    <FormLabel>CNPJ</FormLabel>
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
                    <FormLabel>Categoria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="materiais">Materiais</SelectItem>
                        <SelectItem value="ferramentas">Ferramentas</SelectItem>
                        <SelectItem value="servicos">Serviços</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contato *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="Nome do responsável"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
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
                        placeholder="contato@fornecedor.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
