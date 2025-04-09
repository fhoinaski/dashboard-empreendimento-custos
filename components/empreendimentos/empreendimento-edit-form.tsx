"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  X,
  CalendarIcon,
  Loader2,
  Save,
  Ban,
  Building,
  HardHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { useEmpreendimentos } from "@/hooks/useEmpreendimentos";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { UpdateEmpreendimentoInput } from "@/server/api/schemas/empreendimentos";

const safeParseDate = (
  dateInput: string | Date | undefined | null
): Date | undefined => {
  if (!dateInput) return undefined;
  try {
    let date;
    if (typeof dateInput === "string") date = parseISO(dateInput);
    else if (dateInput instanceof Date) date = dateInput;
    else return undefined;
    return isValid(date) ? date : undefined;
  } catch (e) {
    console.warn("safeParseDate error:", e);
    return undefined;
  }
};

const formSchema = z
  .object({
    name: z.string().min(3, { message: "Nome: Mínimo 3 caracteres." }),
    address: z.string().min(5, { message: "Endereço: Mínimo 5 caracteres." }),
    type: z.string().min(1, { message: "Tipo é obrigatório." }),
    status: z.string().min(1, { message: "Status é obrigatório." }),
    totalUnits: z
      .coerce.number({ invalid_type_error: "Inválido." })
      .int()
      .min(0, "Deve ser 0 ou maior"),
    soldUnits: z
      .coerce.number({ invalid_type_error: "Inválido." })
      .int()
      .min(0, "Deve ser 0 ou maior"),
    startDate: z.date({ required_error: "Obrigatório." }),
    endDate: z.date({ required_error: "Obrigatório." }),
    description: z.string().optional().nullable(),
    responsiblePerson: z.string().min(3, { message: "Mínimo 3 caracteres." }),
    contactEmail: z.string().email({ message: "Email inválido." }),
    contactPhone: z.string().min(10, { message: "Mínimo 10 dígitos." }),
    image: z
      .any()
      .optional()
      .nullable()
      .refine(
        (file) =>
          !file ||
          (typeof file === "object" && file !== null && "size" in file),
        "Deve ser um arquivo válido."
      )
      .refine(
        (file) => !file || file.size <= 10 * 1024 * 1024,
        `Imagem excede 10MB.`
      )
      .refine(
        (file) =>
          !file ||
          ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
            file?.type || ""
          ),
        `Tipo inválido.`
      ),
  })
  .refine((data) => data.soldUnits <= data.totalUnits, {
    message: "Vendidas <= Total.",
    path: ["soldUnits"],
  })
  .refine(
    (data) =>
      data.endDate &&
      data.startDate &&
      isValid(data.endDate) &&
      isValid(data.startDate) &&
      data.endDate >= data.startDate,
    {
      message: "Conclusão >= Início.",
      path: ["endDate"],
    }
  );

type EmpreendimentoFormValues = z.infer<typeof formSchema>;

function getZodObjectShape<T extends z.ZodTypeAny>(
  schema: T
): z.ZodRawShape | null {
  if (schema instanceof z.ZodObject) {
    return schema.shape;
  } else if (schema instanceof z.ZodEffects) {
    return getZodObjectShape(schema._def.schema);
  } else if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return getZodObjectShape(schema.unwrap());
  }
  return null;
}

export default function EmpreendimentoEditForm({ id }: { id: string }) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | undefined>(
    undefined
  );
  const [isUploadingApiRoute, setIsUploadingApiRoute] = useState(false);
  const [wasImageRemoved, setWasImageRemoved] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const { updateEmpreendimento, isUpdating, getEmpreendimentoById } =
    useEmpreendimentos();

  const empreendimentoQuery = getEmpreendimentoById(id);
  const isLoadingData = empreendimentoQuery.isLoading;

  const form = useForm<EmpreendimentoFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      address: "",
      type: "",
      status: "",
      totalUnits: 0,
      soldUnits: 0,
      startDate: undefined,
      endDate: undefined,
      description: null,
      responsiblePerson: "",
      contactEmail: "",
      contactPhone: "",
      image: null,
    },
  });

  useEffect(() => {
    if (empreendimentoQuery.data) {
      const emp = empreendimentoQuery.data;
      console.log("[EditForm useEffect] Data received, resetting form:", emp);
      try {
        const parsedStartDate = safeParseDate(emp.startDate);
        const parsedEndDate = safeParseDate(emp.endDate);
        if (!parsedStartDate || !parsedEndDate) {
          throw new Error("Datas inválidas recebidas da query.");
        }
        const formValues = {
          name: emp.name || "",
          address: emp.address || "",
          type: emp.type || "",
          status: emp.status || "",
          totalUnits: emp.totalUnits ?? 0,
          soldUnits: emp.soldUnits ?? 0,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          description: emp.description || null,
          responsiblePerson: emp.responsiblePerson || "",
          contactEmail: emp.contactEmail || "",
          contactPhone: emp.contactPhone || "",
          image: null,
        };
        form.reset(formValues);
        console.log("[EditForm useEffect] Form reset with values:", formValues);
        console.log(
          "[EditForm useEffect] Form state after reset:",
          form.getValues()
        );
        setCurrentImageUrl(emp.image ?? undefined);
        setSelectedFileName(null);
        setWasImageRemoved(false);
      } catch (parseError) {
        console.error("[EditForm useEffect] Erro ao processar dados:", parseError);
        toast({
          variant: "destructive",
          title: "Erro Dados",
          description: "Info. inválida.",
        });
      }
    } else if (empreendimentoQuery.error) {
      console.error("[EditForm useEffect] Erro na query:", empreendimentoQuery.error);
    }
  }, [empreendimentoQuery.data, empreendimentoQuery.error, form, id, toast]);

  const onSubmit = useCallback(
    async (values: EmpreendimentoFormValues) => {
      let finalImageUrl: string | null | undefined = undefined;
      setIsUploadingApiRoute(false);
      const originalData = empreendimentoQuery.data;
      if (!originalData) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Dados originais não carregados.",
        });
        return;
      }

      try {
        const isFileObject =
          values.image &&
          typeof values.image === "object" &&
          "size" in values.image;
        if (isFileObject) {
          setIsUploadingApiRoute(true);
          console.log("[EditForm] Uploading via API Route...");
          const uploadFormData = new FormData();
          uploadFormData.append("file", values.image as File);
          const uploadResponse = await fetch("/api/upload-s3", {
            method: "POST",
            body: uploadFormData,
          });
          const responseBody = await uploadResponse.json();
          if (!uploadResponse.ok)
            throw new Error(
              responseBody.error || `Upload failed (${uploadResponse.status})`
            );
          if (!responseBody.url)
            throw new Error(responseBody.error || "Failed to get upload URL.");
          finalImageUrl = responseBody.url;
          console.log("[EditForm] Upload OK. URL:", finalImageUrl);
          setWasImageRemoved(false);
          setIsUploadingApiRoute(false);
        } else if (wasImageRemoved) {
          finalImageUrl = null;
          console.log("[EditForm] Image marked for removal.");
        } else {
          finalImageUrl = undefined;
          console.log("[EditForm] No image changes.");
        }

        const dataToUpdate: Partial<UpdateEmpreendimentoInput> = {};
        const schemaShape = getZodObjectShape(formSchema);
        if (!schemaShape) {
          console.error("Could not determine schema shape!");
          throw new Error("Internal error processing form schema.");
        }

        (Object.keys(schemaShape) as Array<keyof EmpreendimentoFormValues>).forEach(
          (key) => {
            if (key === "image") return;
            const formValue = values[key];
            const originalValue = originalData[key as keyof typeof originalData];
            let valueChanged = false;

            if (formValue instanceof Date && originalValue) {
              const originalDate = safeParseDate(originalValue as string);
              valueChanged =
                !originalDate ||
                formValue.toISOString() !== originalDate.toISOString();
            } else if (
              typeof formValue === "number" &&
              typeof originalValue === "number"
            ) {
              valueChanged = formValue !== originalValue;
            } else if (
              typeof formValue === "string" &&
              typeof originalValue === "string"
            ) {
              valueChanged = formValue.trim() !== originalValue.trim();
            } else if (formValue === null && originalValue !== null) {
              valueChanged = true;
            } else if (
              formValue !== null &&
              typeof formValue !== "undefined" &&
              formValue !== originalValue
            ) {
              valueChanged = String(formValue) !== String(originalValue ?? "");
            }

            if (valueChanged) {
              if (key === "startDate" || key === "endDate") {
                dataToUpdate[key] = (formValue as Date)?.toISOString();
              } else {
                const zodField = schemaShape[key];
                const isOptional = zodField instanceof z.ZodOptional;
                const isNullable =
                  zodField instanceof z.ZodNullable ||
                  (zodField instanceof z.ZodOptional &&
                    zodField._def.innerType instanceof z.ZodNullable);
                const canBeNull = isOptional || isNullable;
                (dataToUpdate as any)[key] =
                  formValue === "" && canBeNull ? null : formValue;
              }
            }
          }
        );

        if (finalImageUrl !== undefined) {
          dataToUpdate.image = finalImageUrl;
        }

        console.log("[EditForm] Data for tRPC update:", dataToUpdate);

        if (Object.keys(dataToUpdate).length === 0) {
          toast({ title: "Nenhuma alteração detectada." });
          form.reset({ ...values, image: null }, { keepDirty: false });
          setSelectedFileName(null);
          setCurrentImageUrl(originalData.image ?? undefined);
          setWasImageRemoved(false);
          return;
        }

        await updateEmpreendimento({ id: id, data: dataToUpdate });
        router.push(`/dashboard/empreendimentos/${id}`);
        router.refresh();
      } catch (error: any) {
        setIsUploadingApiRoute(false);
        console.error("Error updating empreendimento:", error);
        toast({
          variant: "destructive",
          title: "Erro ao Salvar",
          description: error.message || "Erro inesperado.",
        });
      }
    },
    [id, router, toast, updateEmpreendimento, empreendimentoQuery.data, form, wasImageRemoved]
  );

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldOnChange: (...event: any[]) => void
  ) => {
    const file = e.target.files?.[0] ?? null;
    form.setValue("image", file, { shouldValidate: true, shouldDirty: true });
    setWasImageRemoved(false);
    setTimeout(() => {
      const fieldState = form.getFieldState("image");
      if (file && !fieldState.error) {
        setSelectedFileName(file.name);
        setSelectedFileSize(file.size);
        const reader = new FileReader();
        reader.onloadend = () => setCurrentImageUrl(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        removeFileInternal(fieldOnChange, false);
        if (!file && !fieldState.error) {
          const fi = document.getElementById(
            "image-upload"
          ) as HTMLInputElement;
          if (fi) fi.value = "";
        }
      }
    }, 0);
  };

  const removeFileInternal = (
    fieldOnChange: (...event: any[]) => void,
    clearInput = true
  ) => {
    fieldOnChange(null);
    setSelectedFileName(null);
    setSelectedFileSize(null);
    setCurrentImageUrl(empreendimentoQuery.data?.image ?? undefined);
    setWasImageRemoved(true);
    form.setValue("image", null, { shouldDirty: true });
    form.clearErrors("image");
    if (clearInput) {
      const fi = document.getElementById("image-upload") as HTMLInputElement;
      if (fi) fi.value = "";
    }
  };

  const removeFile = (fieldOnChange: (...event: any[]) => void) =>
    removeFileInternal(fieldOnChange, true);

  const isProcessing = isLoadingData || isUploadingApiRoute || isUpdating;

  if (isLoadingData) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 border-b pb-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1.5 flex-grow w-full sm:w-auto">
            <Skeleton className="h-6 w-full sm:w-1/2" />
            <Skeleton className="h-4 w-full sm:w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-4">
          <Skeleton className="h-10 w-full sm:w-24" />
          <Skeleton className="h-10 w-full sm:w-28" />
        </div>
      </div>
    );
  }

  if (empreendimentoQuery.error) {
    return (
      <div className="p-6 text-center text-destructive">
        Erro: {empreendimentoQuery.error.message}. Tente recarregar.
      </div>
    );
  }

  if (!empreendimentoQuery.data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Empreendimento não encontrado.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8"
      >
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 border-b pb-4">
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                disabled={isProcessing}
                asChild
              >
                <Link href={`/dashboard/empreendimentos/${id}`} aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Voltar</p>
            </TooltipContent>
          </Tooltip>
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Editar Empreendimento
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Atualize os detalhes do empreendimento.
            </p>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nome <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isProcessing} className="w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Endereço <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isProcessing} className="w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Tipo <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isProcessing}
                          key={`type-${field.value}`} // Forçar re-render
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-background border-2 hover:border-primary focus:ring-2 focus:ring-primary">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Selecione o tipo" />
                              </div>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background border-2">
                            <SelectItem value="Residencial">Residencial</SelectItem>
                            <SelectItem value="Comercial">Comercial</SelectItem>
                            <SelectItem value="Misto">Misto</SelectItem>
                            <SelectItem value="Industrial">Industrial</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Status <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isProcessing}
                          key={`status-${field.value}`} // Forçar re-render
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-background border-2 hover:border-primary focus:ring-2 focus:ring-primary">
                              <div className="flex items-center gap-2">
                                <HardHat className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Selecione o status" />
                              </div>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background border-2">
                            <SelectItem value="Planejamento">Planejamento</SelectItem>
                            <SelectItem value="Em andamento">Em andamento</SelectItem>
                            <SelectItem value="Concluído">Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="totalUnits"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Total Unidades <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : +e.target.value
                              )
                            }
                            disabled={isProcessing}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="soldUnits"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Vendidas <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : +e.target.value
                              )
                            }
                            disabled={isProcessing}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>
                          Início <span className="text-destructive">*</span>
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal border-2",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={isProcessing}
                              >
                                {field.value
                                  ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                  : "Selecione"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={isProcessing}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>
                          Conclusão <span className="text-destructive">*</span>
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal border-2",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={isProcessing}
                              >
                                {field.value
                                  ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                  : "Selecione"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={isProcessing}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[120px] w-full border-2"
                          {...field}
                          value={field.value ?? ""}
                          disabled={isProcessing}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="responsiblePerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Responsável <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isProcessing} className="w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Email Contato <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            {...field}
                            disabled={isProcessing}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Telefone Contato <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isProcessing} className="w-full" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="image-upload">
                        Foto de Capa (Opcional)
                      </FormLabel>
                      <Card
                        className="mt-2 border-dashed border-2 hover:border-primary data-[has-image=true]:border-solid data-[has-image=true]:border-primary/50 w-full"
                        data-has-image={!!currentImageUrl || !!selectedFileName}
                      >
                        <CardContent className="p-4">
                          {(currentImageUrl || selectedFileName) && (
                            <div className="mb-4 relative group">
                              <img
                                src={currentImageUrl || "/placeholder.svg"}
                                alt={selectedFileName ?? "Imagem atual"}
                                className="w-full max-h-48 object-contain rounded-md border bg-muted"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-7 w-7 opacity-80 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeFile(field.onChange)}
                                    disabled={isProcessing}
                                    aria-label="Remover imagem"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Remover Imagem</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                          <label
                            htmlFor="image-upload"
                            className={cn(
                              "flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-md",
                              isProcessing && "cursor-not-allowed opacity-60",
                              !selectedFileName &&
                                !currentImageUrl &&
                                "hover:bg-muted/50"
                            )}
                          >
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-primary font-medium">
                              {selectedFileName
                                ? "Selecionar outra"
                                : currentImageUrl
                                ? "Substituir imagem"
                                : "Selecionar imagem"}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1">
                              ou arraste e solte
                            </span>
                            <span className="text-xs text-muted-foreground mt-2">
                              JPG, PNG, GIF, WEBP (máx. 10MB)
                            </span>
                            <FormControl>
                              <Input
                                id="image-upload"
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleFileSelect(e, field.onChange)}
                                disabled={isProcessing}
                              />
                            </FormControl>
                          </label>
                          <FormMessage className="mt-2" />
                        </CardContent>
                      </Card>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-4 pt-6 mt-6 border-t">
              <Button
                variant="outline"
                type="button"
                onClick={() => router.push(`/dashboard/empreendimentos/${id}`)}
                disabled={isProcessing}
                className="w-full sm:w-auto"
              >
                <Ban className="mr-2 h-4 w-4" /> Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || !form.formState.isDirty}
                className="w-full sm:w-auto"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploadingApiRoute ? "Enviando Imagem..." : "Salvando Dados..."}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </TooltipProvider>
  );
}