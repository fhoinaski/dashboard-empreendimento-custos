"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, X, CalendarIcon, FileText, Building, Loader2, Save, Ban } from "lucide-react"; // Added Building, Loader2, Save, Ban
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


// Validation Schema (similar to create form, image optional on edit)
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const formSchema = z.object({
  name: z.string().min(3, { message: "Nome: Mínimo 3 caracteres." }),
  address: z.string().min(5, { message: "Endereço: Mínimo 5 caracteres." }),
  type: z.string().min(1, { message: "Tipo é obrigatório." }),
  status: z.string().min(1, { message: "Status é obrigatório." }),
  totalUnits: z.coerce.number({ invalid_type_error: "Total de Unidades inválido." }).min(1, { message: "Mínimo 1 unidade." }),
  soldUnits: z.coerce.number({ invalid_type_error: "Unidades Vendidas inválido." }).min(0, { message: "Não pode ser negativo." }),
  startDate: z.date({ required_error: "Data de Início é obrigatória." }),
  endDate: z.date({ required_error: "Data de Conclusão é obrigatória." }),
  description: z.string().min(10, { message: "Descrição: Mínimo 10 caracteres." }).optional().or(z.literal('')), // Allow empty optional string
  responsiblePerson: z.string().min(3, { message: "Responsável: Mínimo 3 caracteres." }),
  contactEmail: z.string().email({ message: "Email de Contato inválido." }),
  contactPhone: z.string().min(10, { message: "Telefone de Contato inválido (inclua DDD)." }),
  image: z.instanceof(File).optional().nullable() // Image is optional during edit
    .refine(file => !file || file.size <= MAX_IMAGE_SIZE_BYTES, `Imagem excede o limite de ${MAX_IMAGE_SIZE_MB}MB.`)
    .refine(file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), `Tipo de imagem inválido. Aceitos: JPG, PNG, GIF, WEBP.`),
}).refine(data => data.soldUnits <= data.totalUnits, {
    message: "Unidades vendidas não podem exceder o total.",
    path: ["soldUnits"], // Attach error to soldUnits field
});

// Define a more specific type for the fetched empreendimento data
interface FetchedEmpreendimento {
    _id: string;
    name: string;
    address: string;
    type: string;
    status: string;
    totalUnits: number;
    soldUnits: number;
    startDate: string; // ISO string from API
    endDate: string; // ISO string from API
    description?: string;
    responsiblePerson: string;
    contactEmail: string;
    contactPhone: string;
    image?: string; // Existing image URL
    // Add other fields if needed (createdAt, folderId, etc.)
}

export default function EmpreendimentoEditForm({ id }: { id: string }) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | undefined>(undefined);
  const [isLoadingData, setIsLoadingData] = useState(true); // Loading state for initial data fetch
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for form submission
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "", address: "", type: "", status: "",
      totalUnits: undefined, soldUnits: undefined,
      startDate: undefined, endDate: undefined,
      description: "", responsiblePerson: "", contactEmail: "", contactPhone: "",
      image: null,
    },
  });

  // Fetch existing data
  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimento() {
      setIsLoadingData(true);
      try {
        const response = await fetch(`/api/empreendimentos/${id}`);
        if (!response.ok) throw new Error("Falha ao carregar dados do empreendimento.");

        const data: { empreendimento: FetchedEmpreendimento } = await response.json();
        console.log("Dados do empreendimento carregados:", data.empreendimento);

        if (isMounted) {
          const emp = data.empreendimento;
           // Validate dates before parsing
           const parsedStartDate = emp.startDate ? parseISO(emp.startDate) : undefined;
           const parsedEndDate = emp.endDate ? parseISO(emp.endDate) : undefined;
           if (!parsedStartDate || !parsedEndDate || isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
                throw new Error("Datas inválidas recebidas da API.");
           }

          form.reset({
            name: emp.name || "",
            address: emp.address || "",
            type: emp.type || "",
            status: emp.status || "",
            totalUnits: emp.totalUnits ?? undefined,
            soldUnits: emp.soldUnits ?? undefined,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            description: emp.description || "",
            responsiblePerson: emp.responsiblePerson || "",
            contactEmail: emp.contactEmail || "",
            contactPhone: emp.contactPhone || "",
          });
          setCurrentImageUrl(emp.image); // Store current image URL
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao carregar empreendimento para edição:", error);
          toast({
            variant: "destructive",
            title: "Erro ao Carregar",
            description: error instanceof Error ? error.message : "Não foi possível carregar os dados.",
          });
        }
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    }
    fetchEmpreendimento();
    return () => { isMounted = false };
  }, [id, toast, form]);

  // Handle form submission
  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      // Append all fields from the form
      Object.entries(values).forEach(([key, value]) => {
        if (key === 'image') return; // Handle image separately
        if (value instanceof Date) {
          formData.append(key, value.toISOString());
        } else if (value !== null && value !== undefined) {
           // Convert number fields specifically to string
           if (typeof value === 'number') {
              formData.append(key, value.toString());
           } else {
              formData.append(key, value);
           }
        }
      });

      // Append the new image only if selected
      if (values.image) {
        formData.append("image", values.image, values.image.name);
         console.log('Enviando nova imagem:', values.image.name);
      } else {
         console.log('Nenhuma nova imagem selecionada.');
      }

      console.log(`Enviando atualização PUT para /api/empreendimentos/${id}`);
      // Log FormData entries for debugging
      // for (let pair of formData.entries()) { console.log(pair[0]+ ', ' + pair[1]); }


      const response = await fetch(`/api/empreendimentos/${id}`, {
        method: "PUT", // Use PUT for updates
        body: formData,
      });

      const responseData = await response.json();
      console.log("Resposta do servidor:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || responseData.details || "Falha ao atualizar empreendimento");
      }

      toast({
        title: "Sucesso!",
        description: "Empreendimento atualizado.",
      });
      // Redirect to details page after successful update
      router.push(`/dashboard/empreendimentos/${id}`);
      router.refresh();

    } catch (error) {
      console.error("Erro ao atualizar empreendimento:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [id, router, toast]);

  // Handle file selection and validation
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (...event: any[]) => void) => {
    const file = e.target.files?.[0] ?? null;

    // Correção: validar diretamente com o formSchema.shape não funciona
    // Criar um esquema específico para validação de arquivo
    const imageSchema = z.instanceof(File).optional().nullable()
      .refine(file => !file || file.size <= MAX_IMAGE_SIZE_BYTES, `Imagem excede o limite de ${MAX_IMAGE_SIZE_MB}MB.`)
      .refine(file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), `Tipo de imagem inválido. Aceitos: JPG, PNG, GIF, WEBP.`);
    
    const validationResult = imageSchema.safeParse(file);

    if (validationResult.success) {
      fieldOnChange(file); // Update form state with the valid file (or null)
      setSelectedFileName(file ? file.name : null);
      setSelectedFileSize(file ? file.size : null);
       // Preview selected image (optional)
       if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
             // Ensure result is a string before setting state
             if (typeof reader.result === 'string') {
                 setCurrentImageUrl(reader.result); // Show preview of NEW image
             } else {
                 console.warn("FileReader result was not a string.");
                 // Handle cases where it might not be a data URL (e.g., ArrayBuffer) if necessary
                 // For basic preview, data URL is expected.
                 // Maybe set a default placeholder if reading fails?
                 // setCurrentImageUrl("/placeholder.svg");
             }
          };
           reader.onerror = (error) => {
              console.error("Error reading file:", error);
              // Handle read error, maybe show a toast or placeholder
              // toast({ variant: "destructive", title: "Erro", description: "Não foi possível ler o arquivo de imagem." });
              // setCurrentImageUrl("/placeholder.svg");
           };
          reader.readAsDataURL(file);
       } else {
          // If file is deselected, clear the preview or revert to original
          // Fetch original URL again or use a stored state if needed
          // For now, just clearing preview:
          setCurrentImageUrl(undefined); // Or revert to the initially fetched URL if stored
       }

    } else {
      fieldOnChange(null); // Clear form state on validation error
      setSelectedFileName(null);
      setSelectedFileSize(null);
      setCurrentImageUrl(undefined); // Clear preview on error
      // Set the specific validation error message from Zod
      form.setError("image", { message: validationResult.error.errors[0]?.message || "Erro na imagem." });
      // Clear the actual file input element so the user can select again
      e.target.value = '';
    }
  };

  // Remove selected file
  const removeFile = (fieldOnChange: (...event: any[]) => void) => {
    fieldOnChange(null);
    setSelectedFileName(null);
    setSelectedFileSize(null);
    setCurrentImageUrl(undefined); // Clear preview or revert to original fetched URL if available
    form.clearErrors("image");
    const fileInput = document.getElementById('image-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = ''; // Clear the file input visually
  };

   // --- Render Loading State ---
   if (isLoadingData) {
     return (
       <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
         <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
           <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
           <div className="space-y-1.5 flex-grow">
             <Skeleton className="h-6 w-3/4 sm:w-1/2" />
             <Skeleton className="h-4 w-1/2 sm:w-1/3" />
           </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-6"> {[...Array(6)].map((_, i) => <Skeleton key={`skel-left-${i}`} className="h-16 w-full" />)} </div>
           <div className="space-y-6"> <Skeleton className="h-24 w-full" /> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> <Skeleton className="h-40 w-full" /> </div>
         </div>
         <div className="flex justify-end gap-4"> <Skeleton className="h-10 w-24" /> <Skeleton className="h-10 w-28" /> </div>
       </div>
     );
   }

  // --- Render Form ---
  return (
    <TooltipProvider>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8" // Increased max-width
    >
      <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" asChild>
                    <Link href={`/dashboard/empreendimentos/${id}`} aria-label="Voltar para Detalhes"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
            </TooltipTrigger>
             <TooltipContent><p>Voltar</p></TooltipContent>
         </Tooltip>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Editar Empreendimento</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Atualize os detalhes do seu projeto.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">

            {/* Left Column */}
            <div className="space-y-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Empreendimento <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Ex: Residencial Vista Alegre" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço Completo <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Ex: Rua das Flores, 123, Bairro Jardim, Cidade - UF, CEP 12345-678" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting} required>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Residencial">Residencial</SelectItem>
                        <SelectItem value="Comercial">Comercial</SelectItem>
                        <SelectItem value="Misto">Misto</SelectItem>
                        <SelectItem value="Industrial">Industrial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting} required>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Planejamento">Planejamento</SelectItem>
                        <SelectItem value="Em andamento">Em andamento</SelectItem>
                        <SelectItem value="Concluído">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="totalUnits" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total de Unidades <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" min="1" placeholder="50" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="soldUnits" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidades Vendidas <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" min="0" placeholder="15" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início <span className="text-destructive">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting} aria-required="true">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={isSubmitting} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Previsão de Conclusão <span className="text-destructive">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting} aria-required="true">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={isSubmitting} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Textarea placeholder="Detalhes sobre o projeto, características, diferenciais..." className="min-h-[120px] resize-y" {...field} disabled={isSubmitting} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="responsiblePerson" render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável pelo Projeto <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Nome completo" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="contactEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de Contato <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="email" placeholder="contato@construtora.com" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="contactPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone de Contato <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="(XX) 9XXXX-XXXX" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Image Upload Section */}
               <FormField control={form.control} name="image" render={({ field }) => (
                 <FormItem>
                   <FormLabel htmlFor="image-upload">Foto de Capa (Opcional)</FormLabel>
                   <Card className="mt-2 border-dashed border-2 hover:border-primary data-[has-image=true]:border-solid data-[has-image=true]:border-primary/50" data-has-image={!!currentImageUrl || !!selectedFileName}>
                     <CardContent className="p-4">
                       {/* Image Preview */}
                       <AnimatePresence>
                         {currentImageUrl && (
                           <motion.div
                             key={currentImageUrl} // Key changes if image changes
                             initial={{ opacity: 0, height: 0 }}
                             animate={{ opacity: 1, height: 'auto' }}
                             exit={{ opacity: 0, height: 0 }}
                             transition={{ duration: 0.3 }}
                             className="mb-4 relative group"
                           >
                             <img
                               src={currentImageUrl}
                               alt={selectedFileName ?? "Imagem atual"}
                               className="w-full max-h-48 object-contain rounded-md border bg-muted" // Use object-contain
                               onError={(e) => { e.currentTarget.src = "/placeholder.svg"; e.currentTarget.alt = "Erro ao carregar imagem"; }}
                             />
                              {selectedFileName && ( // Show remove button only for NEWLY selected image
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                         <Button
                                             type="button"
                                             variant="destructive"
                                             size="icon"
                                             className="absolute top-2 right-2 h-7 w-7 opacity-80 group-hover:opacity-100 transition-opacity"
                                             onClick={() => removeFile(field.onChange)}
                                             disabled={isSubmitting}
                                             aria-label="Remover imagem selecionada"
                                         >
                                             <X className="h-4 w-4" />
                                         </Button>
                                     </TooltipTrigger>
                                     <TooltipContent><p>Remover seleção</p></TooltipContent>
                                </Tooltip>
                               )}
                           </motion.div>
                         )}
                       </AnimatePresence>

                       {/* File Input Trigger */}
                       <label htmlFor="image-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-md", isSubmitting ? "cursor-not-allowed opacity-60 bg-muted/20" : "hover:bg-muted/50")}>
                         <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                         <span className="text-sm text-primary font-medium">
                           {currentImageUrl ? 'Selecionar outra imagem' : 'Selecionar imagem de capa'}
                         </span>
                         <span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span>
                         <span className="text-xs text-muted-foreground mt-2">JPG, PNG, GIF, WEBP (máx. {MAX_IMAGE_SIZE_MB}MB)</span>
                         <FormControl>
                           <Input id="image-upload" type="file" className="hidden" accept={ACCEPTED_IMAGE_TYPES.join(',')} disabled={isSubmitting} ref={field.ref} name={field.name} onBlur={field.onBlur} onChange={(e) => handleFileSelect(e, field.onChange)} />
                         </FormControl>
                       </label>
                       <FormMessage className="mt-2" />
                     </CardContent>
                   </Card>
                 </FormItem>
               )} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t">
            <Button variant="outline" type="button" onClick={() => router.push(`/dashboard/empreendimentos/${id}`)} disabled={isSubmitting} className="w-full sm:w-auto order-last sm:order-first">
                 <Ban className="mr-2 h-4 w-4"/> Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.formState.isDirty} className="w-full sm:w-auto">
              {isSubmitting ? (
                <span className="flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</span>
              ) : (
                 <><Save className="mr-2 h-4 w-4"/> Salvar Alterações</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
    </TooltipProvider>
  );
}