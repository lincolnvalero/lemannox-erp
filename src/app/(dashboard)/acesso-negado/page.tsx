'use client';

import Link from 'next/link';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AcessoNegadoPage() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] md:min-h-screen items-center justify-center p-8">
      <div className="text-center max-w-sm space-y-6">
        {/* Ícone */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldOff className="h-10 w-10 text-destructive" />
          </div>
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Você não tem permissão para acessar esta área. Se acredita que isso é um erro, entre em contato com o administrador do sistema.
          </p>
        </div>

        {/* Ação */}
        <Button asChild className="w-full">
          <Link href="/production">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ir para Produção
          </Link>
        </Button>
      </div>
    </div>
  );
}
