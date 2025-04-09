"use client";

import React from 'react';
import { useTheme } from "next-themes"; // <-- Import directly
import { Sun, Moon, Laptop } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from "@/lib/utils";

export default function AppearanceSettings() {
    // Use the hook directly from next-themes
    const { theme, setTheme } = useTheme();

    return (
        <Card>
            <CardHeader><CardTitle>Aparência</CardTitle><CardDescription>Personalize a aparência do sistema</CardDescription></CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label>Tema</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        <Button variant="outline" onClick={() => setTheme('light')} className={cn(theme === 'light' && 'border-primary ring-1 ring-primary')}> <Sun className="mr-2 h-4 w-4" />Claro </Button>
                        <Button variant="outline" onClick={() => setTheme('dark')} className={cn(theme === 'dark' && 'border-primary ring-1 ring-primary')}> <Moon className="mr-2 h-4 w-4" />Escuro </Button>
                        <Button variant="outline" onClick={() => setTheme('system')} className={cn(theme === 'system' && 'border-primary ring-1 ring-primary')}> <Laptop className="mr-2 h-4 w-4" />Sistema </Button>
                    </div>
                </div>
                <Separator />
                <div>
                    <h3 className="text-lg font-medium mb-3">Idioma e Região</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="lang-select">Idioma</Label>
                            <Select defaultValue="pt-BR" disabled>
                                <SelectTrigger id="lang-select"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="pt-BR">Português (Brasil)</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="currency-select">Moeda</Label>
                            <Select defaultValue="BRL" disabled>
                                <SelectTrigger id="currency-select"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="BRL">Real (R$)</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="date-format-select">Formato Data</Label>
                            <Select defaultValue="dd/MM/yyyy" disabled>
                                <SelectTrigger id="date-format-select"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}