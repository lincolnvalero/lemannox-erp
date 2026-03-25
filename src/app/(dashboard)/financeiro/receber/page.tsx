
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function ContasAReceberPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas a Receber</CardTitle>
        <CardDescription>
          Gerencie todos os valores a receber de clientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <Construction className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold text-muted-foreground">
                Página em Construção
            </p>
            <p className="text-sm text-muted-foreground">
                Esta funcionalidade estará disponível em breve.
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
