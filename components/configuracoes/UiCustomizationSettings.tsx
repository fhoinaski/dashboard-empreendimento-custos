"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, GripVertical, AlertCircle, Info, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useUiConfig } from '@/hooks/useUiConfig';
import { trpc } from '@/lib/trpc/client';
import {
    updateUiConfigDataSchema,
    DynamicUIConfigFieldInput,
    dynamicUIConfigResponseSchema
} from '@/server/api/schemas/uiConfig';
import type { DynamicUIConfigResponse } from '@/server/api/schemas/uiConfig';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Estrutura de Dados para Defaults ---
interface DefaultModuleConfig {
    labels: Record<string, string>;
    fields: DynamicUIConfigFieldInput[];
}
const DEFAULT_MODULE_CONFIGS: Record<string, DefaultModuleConfig> = {
    despesas: {
        labels: {
            description: "Descrição",
            value: "Valor (R$)",
            date: "Data",
            dueDate: "Vencimento",
            status: "Status Pag.",
            approvalStatus: "Status Aprov.",
            category: "Categoria",
            paymentMethod: "Método Pag.",
            notes: "Observações",
            attachments: "Anexos",
            empreendimento: "Empreendimento",
            createdBy: "Criado por",
            reviewedBy: "Revisado por",
        },
        fields: [
            { fieldName: 'empreendimento', label: 'Empreendimento', required: true, visible: true, order: 1 },
            { fieldName: 'description', label: 'Descrição', required: true, visible: true, order: 2 },
            { fieldName: 'value', label: 'Valor (R$)', required: true, visible: true, order: 3 },
            { fieldName: 'date', label: 'Data', required: true, visible: true, order: 4 },
            { fieldName: 'dueDate', label: 'Vencimento', required: true, visible: true, order: 5 },
            { fieldName: 'category', label: 'Categoria', required: true, visible: true, order: 6 },
            { fieldName: 'status', label: 'Status Pag.', required: true, visible: true, order: 7 },
            { fieldName: 'approvalStatus', label: 'Status Aprov.', required: false, visible: true, order: 8 },
            { fieldName: 'paymentMethod', label: 'Método Pag.', required: false, visible: true, order: 9 },
            { fieldName: 'notes', label: 'Observações', required: false, visible: true, order: 10 },
            { fieldName: 'attachments', label: 'Anexos', required: false, visible: true, order: 11 },
            { fieldName: 'createdBy', label: 'Criado por', required: false, visible: false, order: 12 },
            { fieldName: 'reviewedBy', label: 'Revisado por', required: false, visible: false, order: 13 },
        ]
    },
    empreendimentos: {
        labels: {
            name: "Nome",
            address: "Endereço",
            type: "Tipo",
            status: "Status",
            totalUnits: "Total Unid.",
            soldUnits: "Vendidas",
            startDate: "Início",
            endDate: "Conclusão",
            description: "Descrição",
            responsiblePerson: "Responsável",
            contactEmail: "Email Contato",
            contactPhone: "Telefone Contato",
            image: "Foto Capa",
            folderId: "ID Pasta Drive",
            sheetId: "ID Planilha",
            createdBy: "Criado por",
        },
        fields: [
            { fieldName: 'name', label: 'Nome', required: true, visible: true, order: 1 },
            { fieldName: 'address', label: 'Endereço', required: true, visible: true, order: 2 },
            { fieldName: 'type', label: 'Tipo', required: true, visible: true, order: 3 },
            { fieldName: 'status', label: 'Status', required: true, visible: true, order: 4 },
            { fieldName: 'totalUnits', label: 'Total Unid.', required: true, visible: true, order: 5 },
            { fieldName: 'soldUnits', label: 'Vendidas', required: true, visible: true, order: 6 },
            { fieldName: 'startDate', label: 'Início', required: true, visible: true, order: 7 },
            { fieldName: 'endDate', label: 'Conclusão', required: true, visible: true, order: 8 },
            { fieldName: 'responsiblePerson', label: 'Responsável', required: true, visible: true, order: 9 },
            { fieldName: 'contactEmail', label: 'Email Contato', required: true, visible: true, order: 10 },
            { fieldName: 'contactPhone', label: 'Telefone Contato', required: true, visible: true, order: 11 },
            { fieldName: 'description', label: 'Descrição', required: false, visible: true, order: 12 },
            { fieldName: 'image', label: 'Foto Capa', required: false, visible: true, order: 13 },
            { fieldName: 'folderId', label: 'ID Pasta Drive', required: false, visible: false, order: 14 },
            { fieldName: 'sheetId', label: 'ID Planilha', required: false, visible: false, order: 15 },
            { fieldName: 'createdBy', label: 'Criado por', required: false, visible: false, order: 16 },
        ]
    },
};

// --- Schema Zod ---
const uiCustomizationFormSchema = z.object({
    module: z.string().min(1, "Selecione um módulo"),
    data: updateUiConfigDataSchema
});
type UiCustomizationFormValues = z.infer<typeof uiCustomizationFormSchema>;
const CONFIGURABLE_MODULES = Object.keys(DEFAULT_MODULE_CONFIGS);

// --- Função Helper para Merge ---
const mergeConfigWithDefaults = (
    moduleName: string,
    savedConfig: DynamicUIConfigResponse | null,
    defaults: DefaultModuleConfig
): { labels: Record<string, string>, fields: DynamicUIConfigFieldInput[] } => {
    // Merge Labels
    const mergedLabels = { ...defaults.labels };
    if (savedConfig?.labels) {
        for (const [key, value] of Object.entries(savedConfig.labels)) {
            if (key in mergedLabels && value && typeof value === 'string' && value.trim() !== '') {
                mergedLabels[key] = value;
            }
        }
    }

    // Merge Fields
    const savedFieldsMap = new Map<string, DynamicUIConfigFieldInput>(
        savedConfig?.fields?.map((f: DynamicUIConfigFieldInput) => [f.fieldName, f]) ?? []
    );
    const mergedFields: DynamicUIConfigFieldInput[] = defaults.fields.map((defaultField, index) => {
        const savedField = savedFieldsMap.get(defaultField.fieldName);
        if (savedField) {
            return {
                fieldName: defaultField.fieldName,
                label: typeof savedField.label === 'string' && savedField.label.trim() !== '' ? savedField.label : defaultField.label,
                required: typeof savedField.required === 'boolean' ? savedField.required : defaultField.required,
                visible: typeof savedField.visible === 'boolean' ? savedField.visible : defaultField.visible,
                order: typeof savedField.order === 'number' ? savedField.order : (typeof defaultField.order === 'number' ? defaultField.order : index + 1),
            };
        }
        return { ...defaultField, order: defaultField.order ?? index + 1 };
    });

    // Adicionar campos salvos que não estão nos defaults
    savedConfig?.fields?.forEach((savedField: DynamicUIConfigFieldInput) => {
        if (!mergedFields.some(mf => mf.fieldName === savedField.fieldName)) {
            mergedFields.push({ ...savedField, order: savedField.order ?? 999 });
        }
    });

    // Ordenar campos por 'order'
    mergedFields.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    return { labels: mergedLabels, fields: mergedFields };
};

// --- Componente Principal ---
export default function UiCustomizationSettings() {
    const { toast } = useToast();
    const [selectedModule, setSelectedModule] = useState<string>("");
    const loadedModuleRef = useRef<string | null>(null);

    const { config: currentConfig, isLoading: isLoadingConfig, refetch: refetchConfig, error: configError } = useUiConfig(selectedModule || undefined);
    const updateMutation = trpc.uiConfig.updateUiConfig.useMutation({
        onSuccess: (data) => {
            toast({ title: "Sucesso", description: `Configuração do módulo '${data.module}' salva.` });
            refetchConfig();
        },
        onError: (error) => {
            toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message });
        },
    });

    const form = useForm<UiCustomizationFormValues>({
        resolver: zodResolver(uiCustomizationFormSchema),
        defaultValues: { module: "", data: { labels: {}, fields: [] } },
    });

    const { fields: formFields, move } = useFieldArray({
        control: form.control,
        name: "data.fields",
        keyName: "fieldArrayId",
    });

    // --- Efeito para Popular o Formulário ---
    useEffect(() => {
        if (selectedModule && !isLoadingConfig) {
            const defaults = DEFAULT_MODULE_CONFIGS[selectedModule] || { labels: {}, fields: [] };
            const shouldResetForm = loadedModuleRef.current !== selectedModule || currentConfig !== undefined || (configError as any)?.data?.code === 'NOT_FOUND';

            if (shouldResetForm) {
                const configToUse = (configError as any)?.data?.code === 'NOT_FOUND' ? null : currentConfig;
                const isNotFound = (configError as any)?.data?.code === 'NOT_FOUND';

                if (configError && !isNotFound) {
                    console.error("[UiCustomizationSettings] Erro ao carregar configuração:", configError);
                    toast({
                        variant: "destructive",
                        title: "Erro",
                        description: "Falha ao carregar configuração. Tente novamente.",
                    });
                } else {
                    const mergedData = mergeConfigWithDefaults(selectedModule, configToUse, defaults);
                    form.reset({ module: selectedModule, data: mergedData }, { keepDirty: false });
                    loadedModuleRef.current = selectedModule;
                }
            }
        } else if (!selectedModule && loadedModuleRef.current !== null) {
            form.reset({ module: "", data: { labels: {}, fields: [] } });
            loadedModuleRef.current = null;
        }
    }, [selectedModule, currentConfig, isLoadingConfig, configError, form, toast]);

    // --- Handlers ---
    const onSubmit = useCallback(async (values: UiCustomizationFormValues) => {
        if (!values.module) return;
        const dataToSave = {
            ...values.data,
            fields: form.getValues("data.fields")?.map((field, index) => ({ ...field, order: index + 1 })),
        };
        await updateMutation.mutateAsync({ module: values.module, data: dataToSave });
    }, [updateMutation, form]);

    const handleModuleChange = useCallback((value: string) => {
        loadedModuleRef.current = null; // Força reset do form
        setSelectedModule(value);
    }, []);

    const onDragEnd = useCallback((result: DropResult) => {
        if (!result.destination || result.source.index === result.destination.index) return;
        move(result.source.index, result.destination.index);
        requestAnimationFrame(() => {
            form.trigger().then(() => {
                form.setValue("data.fields", form.getValues("data.fields"), { shouldDirty: true });
            });
        });
    }, [move, form]);

    const isLoading = isLoadingConfig || updateMutation.isPending;
    const formHasChanges = form.formState.isDirty;

    const getLabelsFromFormData = () => form.getValues("data.labels") || {};
    const getFieldsFromFormData = () => form.getValues("data.fields") || [];

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="h-5 w-5" />
                            Personalizar Interface
                        </CardTitle>
                        <CardDescription>
                            Ajuste labels e a visibilidade/obrigatoriedade dos campos para cada módulo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* --- Seletor de Módulo --- */}
                        <FormField
                            control={form.control}
                            name="module"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Módulo a Configurar</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            handleModuleChange(value);
                                            field.onChange(value);
                                        }}
                                        value={field.value ?? ""}
                                        disabled={isLoading}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full md:w-1/2 lg:w-1/3">
                                                <SelectValue
                                                    placeholder={isLoadingConfig && selectedModule ? "Carregando..." : "Selecione um módulo..."}
                                                />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {CONFIGURABLE_MODULES.map((mod) => (
                                                <SelectItem key={mod} value={mod}>
                                                    {mod.charAt(0).toUpperCase() + mod.slice(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Separator className={cn(!selectedModule && "hidden")} />

                        {/* --- Área de Configuração --- */}
                        <AnimatePresence>
                            {selectedModule && (
                                <motion.div
                                    key={selectedModule}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                    className="pt-4"
                                >
                                    {isLoadingConfig && loadedModuleRef.current !== selectedModule ? (
                                        <div className="space-y-4 pt-4">
                                            <Skeleton className="h-8 w-1/3" />
                                            <Skeleton className="h-40 w-full" />
                                            <Skeleton className="h-8 w-1/3" />
                                            <Skeleton className="h-60 w-full" />
                                        </div>
                                    ) : configError && (configError as any)?.data?.code !== 'NOT_FOUND' ? (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Erro ao Carregar</AlertTitle>
                                            <AlertDescription>
                                                Não foi possível carregar a configuração. Tente selecionar o módulo novamente.
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* --- Labels --- */}
                                            <div>
                                                <h3 className="text-lg font-medium mb-3">Labels do Módulo</h3>
                                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 rounded-md border p-3">
                                                    {Object.keys(getLabelsFromFormData()).length === 0 ? (
                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                            Nenhum label configurável.
                                                        </p>
                                                    ) : (
                                                        Object.entries(getLabelsFromFormData())
                                                            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                                                            .map(([originalLabel]) => (
                                                                <FormField
                                                                    key={originalLabel}
                                                                    control={form.control}
                                                                    name={`data.labels.${originalLabel}`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 border-b pb-2 last:border-b-0">
                                                                            <FormLabel
                                                                                className="text-sm text-muted-foreground flex-shrink-0 w-full sm:w-1/3 truncate"
                                                                                title={originalLabel}
                                                                            >
                                                                                {originalLabel}:
                                                                            </FormLabel>
                                                                            <FormControl className="flex-1">
                                                                                <Input
                                                                                    {...field}
                                                                                    placeholder={originalLabel}
                                                                                    className="h-8 text-sm"
                                                                                    disabled={updateMutation.isPending}
                                                                                    value={field.value ?? ''}
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            ))
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                                    <Info className="h-3 w-3" />
                                                    Deixe em branco para usar o label padrão.
                                                </p>
                                            </div>
                                            <Separator />
                                            {/* --- Fields --- */}
                                            <div>
                                                <h3 className="text-lg font-medium mb-3">Campos do Módulo</h3>
                                                {formFields.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-muted/30">
                                                        Nenhum campo configurável.
                                                    </p>
                                                ) : (
                                                    <div className="border rounded-md p-2">
                                                        <div className="hidden sm:flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b mb-2">
                                                            <span className="w-8 flex-shrink-0"></span>
                                                            <span className="flex-1 min-w-[150px]">Label Exibido (Nome Interno)</span>
                                                            <span className="w-16 text-center flex-shrink-0">Visível</span>
                                                            <span className="w-20 text-center flex-shrink-0">Obrigatório</span>
                                                        </div>
                                                        <DragDropContext onDragEnd={onDragEnd}>
                                                            <Droppable droppableId="fields">
                                                                {(provided: DroppableProvided) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.droppableProps}
                                                                        className="space-y-1"
                                                                    >
                                                                        {formFields.map((formField, index) => (
                                                                            <Draggable
                                                                                key={formField.fieldArrayId}
                                                                                draggableId={formField.fieldArrayId}
                                                                                index={index}
                                                                            >
                                                                                {(providedDrag: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                                                                    <div
                                                                                        ref={providedDrag.innerRef}
                                                                                        {...providedDrag.draggableProps}
                                                                                        className={cn(
                                                                                            "flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 border rounded-md transition-shadow",
                                                                                            snapshot.isDragging
                                                                                                ? "shadow-lg bg-muted/80"
                                                                                                : "bg-muted/30 hover:bg-muted/50"
                                                                                        )}
                                                                                    >
                                                                                        <span
                                                                                            {...providedDrag.dragHandleProps}
                                                                                            className="cursor-grab text-muted-foreground hover:text-foreground p-1 self-center sm:self-auto"
                                                                                            aria-label="Reordenar campo"
                                                                                        >
                                                                                            <GripVertical className="h-5 w-5" />
                                                                                        </span>
                                                                                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-4 gap-y-2 flex-1 w-full">
                                                                                            <FormField
                                                                                                control={form.control}
                                                                                                name={`data.fields.${index}.label`}
                                                                                                render={({ field }) => (
                                                                                                    <FormItem className="col-span-2 sm:flex-1 sm:min-w-[150px]">
                                                                                                        <FormLabel className="text-xs text-muted-foreground sm:hidden">
                                                                                                            Label
                                                                                                        </FormLabel>
                                                                                                        <FormControl>
                                                                                                            <Input
                                                                                                                {...field}
                                                                                                                className="h-8 text-sm"
                                                                                                                disabled={updateMutation.isPending}
                                                                                                            />
                                                                                                        </FormControl>
                                                                                                        <FormMessage className="text-xs" />
                                                                                                        <p
                                                                                                            className="text-[10px] text-muted-foreground truncate mt-0.5"
                                                                                                            title={`Nome interno: ${formField.fieldName}`}
                                                                                                        >
                                                                                                            ({formField.fieldName})
                                                                                                        </p>
                                                                                                    </FormItem>
                                                                                                )}
                                                                                            />
                                                                                            <FormField
                                                                                                control={form.control}
                                                                                                name={`data.fields.${index}.visible`}
                                                                                                render={({ field }) => (
                                                                                                    <FormItem className="col-span-1 sm:w-16 flex flex-col items-center justify-center space-y-1 flex-shrink-0">
                                                                                                        <FormLabel className="text-xs text-muted-foreground">
                                                                                                            Visível
                                                                                                        </FormLabel>
                                                                                                        <FormControl>
                                                                                                            <Switch
                                                                                                                checked={!!field.value}
                                                                                                                onCheckedChange={field.onChange}
                                                                                                                disabled={updateMutation.isPending}
                                                                                                            />
                                                                                                        </FormControl>
                                                                                                    </FormItem>
                                                                                                )}
                                                                                            />
                                                                                            <FormField
                                                                                                control={form.control}
                                                                                                name={`data.fields.${index}.required`}
                                                                                                render={({ field }) => (
                                                                                                    <FormItem className="col-span-1 sm:w-20 flex flex-col items-center justify-center space-y-1 flex-shrink-0">
                                                                                                        <FormLabel className="text-xs text-muted-foreground">
                                                                                                            Obrigatório
                                                                                                        </FormLabel>
                                                                                                        <FormControl>
                                                                                                            <Switch
                                                                                                                checked={!!field.value}
                                                                                                                onCheckedChange={field.onChange}
                                                                                                                disabled={updateMutation.isPending}
                                                                                                            />
                                                                                                        </FormControl>
                                                                                                    </FormItem>
                                                                                                )}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </Draggable>
                                                                        ))}
                                                                        {provided.placeholder}
                                                                    </div>
                                                                )}
                                                            </Droppable>
                                                        </DragDropContext>
                                                    </div>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                                                    <Info className="h-3 w-3" />
                                                    Arraste para reordenar os campos.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                    <CardFooter className={cn("flex justify-end border-t pt-4", !selectedModule && "hidden")}>
                        <Button type="submit" disabled={isLoading || !selectedModule || !formHasChanges}>
                            {updateMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Salvar Configurações
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}