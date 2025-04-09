// components/configuracoes/backup-settings.tsx
"use client";

import React, { useState } from 'react';
import { Server, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { trpc } from '@/lib/trpc/client';
import { TRPCClientErrorLike } from '@trpc/client'; // Importar tipo de erro tRPC
import type { AppRouter } from '@/server/api/root'; // Importar o tipo do AppRouter
import type { GenerateCsvResponse, SaveToDriveResponse } from '@/server/api/schemas/backup'; // Importar tipos de resposta do backend

// --- Função Auxiliar de Download (sem alterações) ---
function downloadCsv(csvContent: string, fileName: string) {
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log(`[Download Helper] Download do arquivo ${fileName} iniciado.`);
    } catch (error) {
        console.error("[Download Helper] Erro ao criar Blob/URL ou iniciar download:", error);
        throw new Error("Falha ao preparar o arquivo para download.");
    }
}

export default function BackupSettings() {
    const { toast } = useToast();
    const [backupInProgress, setBackupInProgress] = useState<'local' | 'drive' | null>(null);

    // --- Mutação para GERAR CSV e Download ---
    const generateCsvMutation = trpc.backup.generateCsv.useMutation({
        // Tipagem explícita para 'data'
        onSuccess: (data: GenerateCsvResponse) => {
            if (data.success && data.csvContent && data.fileName) {
                try {
                    downloadCsv(data.csvContent, data.fileName);
                    toast({ title: "Backup Pronto", description: `Download de ${data.fileName} iniciado.` });
                } catch(downloadError: any) {
                     toast({ variant: "destructive", title: "Erro Download", description: downloadError.message || "Falha ao processar download." });
                }
            } else {
                 toast({ variant: "destructive", title: "Erro Backup", description: data.message || "Resposta inválida do servidor." });
            }
        },
        // Tipagem explícita para 'error'
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({ variant: "destructive", title: "Erro ao Gerar Backup", description: error.message || "Falha na comunicação com o servidor." });
            console.error("Erro ao gerar backup CSV via tRPC:", error);
        },
        onSettled: () => {
            setBackupInProgress(null);
        }
    });

    // --- Mutação para SALVAR NO DRIVE (ainda placeholder) ---
    const saveToDriveMutation = trpc.backup.saveToDrive.useMutation({
        // Tipagem explícita para 'data'
        onSuccess: (data: SaveToDriveResponse) => { // Use o tipo correto aqui também
            toast({ title: "Backup no Drive", description: data.message || "Processo iniciado." });
            // Adicionar lógica se precisar fazer algo com data.driveFileId
        },
        // Tipagem explícita para 'error'
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({ variant: "destructive", title: "Erro Backup Drive", description: error.message || "Falha ao salvar no Drive." });
            console.error("Erro ao salvar backup no Drive via tRPC:", error);
        },
        onSettled: () => {
            setBackupInProgress(null);
        }
    });

    // Estado geral de processamento (sem alterações)
    const isProcessing = backupInProgress !== null;

    // Handler para Backup Local (sem alterações na lógica principal)
    const handleLocalBackupTrigger = async () => {
        console.log("Iniciando geração de backup CSV...");
        setBackupInProgress('local');
        try {
            // Nenhuma mudança aqui, apenas chama a mutação
            await generateCsvMutation.mutateAsync();
        } catch (error) {
            console.error("Erro capturado no handleLocalBackupTrigger (inesperado):", error);
            // O onError da mutação já tratou o erro
        }
        // onSettled limpa o estado
    };

    // Handler para Backup no Drive (sem alterações na lógica principal)
    const handleDriveBackupTrigger = async () => {
        console.log("Iniciando backup para Google Drive...");
        setBackupInProgress('drive');
        try {
            // Nenhuma mudança aqui, apenas chama a mutação
            await saveToDriveMutation.mutateAsync();
        } catch (error) {
            console.error("Erro capturado no handleDriveBackupTrigger (inesperado):", error);
             // O onError da mutação já tratou o erro
        }
        // onSettled limpa o estado
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Backup de Dados</CardTitle>
                <CardDescription>Realize backups manuais do banco de dados.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    Escolha onde deseja salvar o backup completo dos dados do sistema (banco de dados).
                    O processo pode levar alguns minutos.
                </p>
                {/* UI (sem alterações) */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={handleLocalBackupTrigger} disabled={isProcessing}>
                        {backupInProgress === 'local' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {backupInProgress === 'local' ? 'Gerando CSV...' : 'Backup Local (Download CSV)'}
                    </Button>
                    <Button onClick={handleDriveBackupTrigger} disabled={isProcessing}>
                        {backupInProgress === 'drive' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />}
                        {backupInProgress === 'drive' ? 'Salvando no Drive...' : 'Salvar no Google Drive'}
                    </Button>
                </div>
                <p className="text-xs text-amber-600 mt-4 border-l-2 border-amber-600 pl-2">
                      <strong>Nota:</strong> A funcionalidade "Salvar no Google Drive" ainda está em desenvolvimento no backend.
                 </p>
            </CardContent>
        </Card>
    );
}