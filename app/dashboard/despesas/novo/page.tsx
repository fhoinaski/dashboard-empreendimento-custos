import type { Metadata } from "next";
import DespesaForm from "@/components/despesas/despesa-form";
import { Suspense } from "react";
// Importe o componente Skeleton
import { DespesaFormSkeleton } from "@/components/despesas/despesa-form-skeleton";

export const metadata: Metadata = {
  title: "Nova Despesa | Scotta Empreendimentos", // Título mais descritivo
  description: "Registre uma nova despesa para um empreendimento", // Descrição mais descritiva
};

export default function NovaDespesaPage() {
  return (
    // Use o Skeleton como fallback
    <Suspense fallback={<DespesaFormSkeleton />}>
      <DespesaForm />
    </Suspense>
  );
}