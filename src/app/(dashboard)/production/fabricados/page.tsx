import { FabricadosReport } from '@/components/dashboard/fabricados-report';

export default function FabricadosPage() {
  return (
    <div className="flex-1 space-y-4 p-3 md:p-8">
      <h1 className="hidden md:block text-2xl font-bold tracking-tight">Produtos Fabricados</h1>
      <FabricadosReport />
    </div>
  );
}
