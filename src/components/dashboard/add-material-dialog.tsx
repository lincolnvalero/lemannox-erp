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
import { Material, Supplier } from "@/lib/types";
import { upsertMaterial } from "@/app/(dashboard)/materials/actions";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  unit: z.string().min(1, "Unidade obrigatória"),
  category: z.string().optional(),
  quantity: z.coerce.number().min(0, "Quantidade não pode ser negativa"),
  minQuantity: z.coerce.number().min(0, "Quantidade mínima não pode ser negativa"),
  unitCost: z.coerce.number().min(0, "Custo não pode ser negativo"),
  supplierId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingMaterial: Material | null;
  suppliers?: Supplier[];
  onSaveSuccess: () => void;
}

export function AddMaterialDialog({
  open,
  onOpenChange,
  editingMaterial,
  suppliers = [],
  onSaveSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      unit: "",
      category: "",
      quantity: 0,
      minQuantity: 0,
      unitCost: 0,
      supplierId: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    if (editingMaterial) {
      form.reset({
        name: editingMaterial.name,
        unit: editingMaterial.unit,
        category: editingMaterial.category ?? "",
        quantity: editingMaterial.quantity,
        minQuantity: editingMaterial.minQuantity,
        unitCost: editingMaterial.unitCost,
        supplierId: editingMaterial.supplierId ?? "",
      });
    } else {
      form.reset({
        name: "",
        unit: "",
        category: "",
        quantity: 0,
        minQuantity: 0,
        unitCost: 0,
        supplierId: "",
      });
    }
  }, [open, editingMaterial, form]);

  async function onSubmit(values: FormValues) {
    setLoading(true);

    const selectedSupplier = suppliers.find((s) => s.id === values.supplierId);

    const fd = new FormData();
    if (editingMaterial?.id) fd.append("id", editingMaterial.id);
    fd.append("name", values.name);
    fd.append("unit", values.unit);
    fd.append("category", values.category ?? "");
    fd.append("quantity", String(values.quantity));
    fd.append("minQuantity", String(values.minQuantity));
    fd.append("unitCost", String(values.unitCost));
    fd.append("supplierId", values.supplierId ?? "");
    fd.append("supplierName", selectedSupplier?.name ?? "");

    const result = await upsertMaterial(fd);

    setLoading(false);

    if (result.success) {
      onOpenChange(false);
      onSaveSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>
            {editingMaterial ? "Editar Material" : "Novo Material"}
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
                      placeholder="Ex: Chapa Inox 430 1,2mm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="m">m</SelectItem>
                        <SelectItem value="m2">m²</SelectItem>
                        <SelectItem value="un">un</SelectItem>
                        <SelectItem value="l">l</SelectItem>
                        <SelectItem value="m3">m³</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="Ex: Chapa, Tubo, Parafuso"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mínimo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo unit. (R$)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700">
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
