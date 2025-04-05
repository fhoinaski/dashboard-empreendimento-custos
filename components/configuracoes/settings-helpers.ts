import React from 'react';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { z } from 'zod'; // Manter Zod para tipos, se necessário, mas não para validação direta aqui
import { Input } from '@/components/ui/input';

// Tipos para validação preliminar (ajuste conforme necessário)
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// Helper para lidar com seleção de arquivo (sem validação Zod interna)
export const handleFileSelect = <T extends FieldValues>(
    e: React.ChangeEvent<HTMLInputElement>,
    fieldOnChange: (file: File | null) => void, // Função para atualizar o RHF
    setFileName: React.Dispatch<React.SetStateAction<string | null>>,
    setPreviewUrl: React.Dispatch<React.SetStateAction<string | undefined>>,
    fieldName: Path<T>, // Nome do campo no schema RHF
    form: UseFormReturn<T>, // Instância do formulário RHF
    // Adicionar parâmetros opcionais para limites específicos do campo
    maxSizeBytes?: number,
    acceptedTypes?: string[]
) => {
    const file = e.target.files?.[0] ?? null;

    // Limpa erros anteriores para este campo
    form.clearErrors(fieldName);

    if (file) {
        const currentMaxSize = maxSizeBytes ?? Infinity; // Usa o limite específico ou nenhum limite
        const currentAcceptedTypes = acceptedTypes ?? []; // Usa os tipos específicos ou nenhum

        // 1. Verificação Preliminar de Tamanho
        if (file.size > currentMaxSize) {
            form.setError(fieldName, { message: `Arquivo excede o limite de ${(currentMaxSize / 1024 / 1024).toFixed(0)}MB.` });
            fieldOnChange(null); // Limpa RHF
            setFileName(null);
            setPreviewUrl(undefined); // Limpa preview
            e.target.value = ''; // Limpa input visualmente
            return; // Interrompe se o tamanho for inválido
        }

        // 2. Verificação Preliminar de Tipo
        if (currentAcceptedTypes.length > 0 && !currentAcceptedTypes.includes(file.type)) {
            form.setError(fieldName, { message: `Tipo de arquivo inválido. Aceitos: ${currentAcceptedTypes.join(', ')}` });
            fieldOnChange(null); // Limpa RHF
            setFileName(null);
            setPreviewUrl(undefined); // Limpa preview
            e.target.value = ''; // Limpa input visualmente
            return; // Interrompe se o tipo for inválido
        }

        // Se passou nas verificações preliminares:
        fieldOnChange(file); // Atualiza RHF (o Zod resolver validará novamente)
        setFileName(file.name);
        // Gera preview
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') setPreviewUrl(reader.result);
        };
         reader.onerror = () => { // Adiciona tratamento de erro para leitura
             console.error("Erro ao ler o arquivo para preview.");
             setPreviewUrl(undefined); // Limpa preview em caso de erro de leitura
             form.setError(fieldName, { message: "Não foi possível ler o arquivo selecionado." });
         };
        reader.readAsDataURL(file);

    } else {
        // Se nenhum arquivo foi selecionado (ou foi removido)
        fieldOnChange(null); // Limpa RHF
        setFileName(null);
        setPreviewUrl(undefined); // Limpa preview
    }
};

// Helper para remover arquivo selecionado (sem alterações necessárias aqui)
export const removeFile = <T extends FieldValues>(
    fieldOnChange: (file: File | null) => void,
    setFileName: React.Dispatch<React.SetStateAction<string | null>>,
    setPreviewUrl: React.Dispatch<React.SetStateAction<string | undefined>>,
    fieldName: Path<T>,
    originalUrl: string | undefined,
    form: UseFormReturn<T>
) => {
    fieldOnChange(null);
    setFileName(null);
    setPreviewUrl(originalUrl);
    form.clearErrors(fieldName);
    // Assume um ID padrão baseado no nome do campo para limpar o input
    const fileInput = document.getElementById(`${fieldName}-upload`) as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
};