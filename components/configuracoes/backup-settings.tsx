"use client";

import React, { useState } from 'react';
import { Server, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function BackupSettings() {
    const { toast } = useToast();
    const [isBackingUp, setIsBackingUp] = useState(false);

    const handleBackupTrigger = async () => {
        setIsBackingUp(true);
        try {
            const response = await fetch('/api/backup', { method: 'POST' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao iniciar backup');
            toast({ title: "Backup Iniciado", description: data.message });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro Backup", description: error instanceof Error ? error.message : "Falha ao iniciar backup" });
        } finally {
            setIsBackingUp(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Backup de Dados</CardTitle>
                <CardDescription>Realize backups manuais do banco de dados.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    Clique no botão abaixo para iniciar um backup completo dos dados do sistema (banco de dados).
                    O arquivo de backup será salvo no local configurado (ex: S3, Google Drive).
                    Este processo pode levar alguns minutos.
                </p>
                <Button onClick={handleBackupTrigger} disabled={isBackingUp}>
                    {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />}
                    {isBackingUp ? 'Realizando Backup...' : 'Iniciar Backup Manual'}
                </Button>
            </CardContent>
        </Card>
    );
}