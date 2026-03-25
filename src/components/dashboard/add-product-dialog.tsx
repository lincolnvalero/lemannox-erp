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
import { Product } from "@/lib/types";
import { upsertProduct } from "@/app/(dashboard)/products/actions";

const MATERIALS = ["Inox 430", "Inox 304", "Aço Carbono"] as const;
const NEW_CATEGORY_VALUE = "__nova__";

const schema = z.object({
  category: z.string().min(1, "Categoria obrigatória"),
  newCategory: z.string().optional(),
  model: z.string().min(1, "Modelo obrigatório"),
  measurement: z.string().min(1, "Medida obrigatória"),
  priceInox430: z.coerce.number().min(0).optional(),
  priceInox304: z.coerce.number().min(0).optional(),
  priceAcoCarbono: z.coerce.number().min(0).optional(),
  pricePadrao: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  categories: string[];
  onSaveSuccess: () => void;
}

export function AddProductDialog({
  open,
  onOpenChange,
  editingProduct,
  categories,
  onSaveSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "",
      newCategory: "",
      model: "",
      measurement: "",
      priceInox430: undefined,
      priceInox304: undefined,
      priceAcoCarbono: undefined,
      pricePadrao: undefined,
    },
  });

  const watchedCategory = form.watch("category");
  const watchedNewCategory = form.watch("newCategory");
  const isOthers =
    watchedCategory === "Outros" ||
    (watchedCategory === NEW_CATEGORY_VALUE && watchedNewCategory === "Outros");

  useEffect(() => {
    if (!open) return;

    if (editingProduct) {
      const getPrice = (material: string) =>
        editingProduct.variations.find((v) => v.material === material)?.price;

      form.reset({
        category: editingProduct.category,
        newCategory: "",
        model: editingProduct.model,
        measurement: editingProduct.measurement,
        priceInox430: getPrice("Inox 430"),
        priceInox304: getPrice("Inox 304"),
        priceAcoCarbono: getPrice("Aço Carbono"),
        pricePadrao: getPrice("Padrão"),
      });
    } else {
      form.reset({
        category: "",
        newCategory: "",
        model: "",
        measurement: "",
        priceInox430: undefined,
        priceInox304: undefined,
        priceAcoCarbono: undefined,
        pricePadrao: undefined,
      });
    }
  }, [open, editingProduct, form]);

  async function onSubmit(values: FormValues) {
    setLoading(true);

    const finalCategory =
      values.category === NEW_CATEGORY_VALUE
        ? (values.newCategory ?? "")
        : values.category;

    const variations = isOthers
      ? [{ id: crypto.randomUUID(), material: "Padrão", price: values.pricePadrao ?? 0 }]
      : MATERIALS.map((mat, i) => ({
          id: crypto.randomUUID(),
          material: mat,
          price:
            i === 0
              ? (values.priceInox430 ?? 0)
              : i === 1
              ? (values.priceInox304 ?? 0)
              : (values.priceAcoCarbono ?? 0),
        }));

    const fd = new FormData();
    if (editingProduct?.id) fd.append("id", editingProduct.id);
    fd.append("category", finalCategory);
    fd.append("model", values.model);
    fd.append("measurement", values.measurement);
    fd.append("variations", JSON.stringify(variations));

    const result = await upsertProduct(fd);

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
          <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_CATEGORY_VALUE}>+ Nova categoria</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedCategory === NEW_CATEGORY_VALUE && (
              <FormField
                control={form.control}
                name="newCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da nova categoria</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-zinc-800 border-zinc-700"
                        placeholder="Ex: Corrimão"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="Ex: LMX-001"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="measurement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medida</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="Ex: 1,20m x 0,80m"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-300">Variações de preço</p>

              {isOthers ? (
                <FormField
                  control={form.control}
                  name="pricePadrao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Padrão (R$)</FormLabel>
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
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="priceInox430"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inox 430 (R$)</FormLabel>
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
                  <FormField
                    control={form.control}
                    name="priceInox304"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inox 304 (R$)</FormLabel>
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
                  <FormField
                    control={form.control}
                    name="priceAcoCarbono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aço Carbono (R$)</FormLabel>
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
              )}
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
