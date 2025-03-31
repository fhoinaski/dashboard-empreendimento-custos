"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function DocumentosPage() {
  const [empreendimentos, setEmpreendimentos] = useState<any[]>([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Carregar empreendimentos dinamicamente
  useEffect(() => {
    async function fetchEmpreendimentos() {
      try {
        const response = await fetch("/api/empreendimentos", {
          credentials: "include",
        });
        if (!response.ok) {
          if (response.status === 401) {
            toast({
              variant: "destructive",
              title: "Erro",
              description: "Você precisa estar logado para acessar os empreendimentos",
            });
            router.push("/auth/signin");
            return;
          }
          throw new Error("Falha ao carregar empreendimentos");
        }
        const data = await response.json();
        setEmpreendimentos(data.empreendimentos);
      } catch (error) {
        console.error("Erro ao carregar empreendimentos:", error);
        toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar empreendimentos" });
      }
    }
    fetchEmpreendimentos();
  }, [toast, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleUpload() {
    if (!selectedEmpreendimento || files.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um empreendimento e pelo menos um arquivo",
      });
      return;
    }

    setIsUploading(true);
    try {
      const empreendimento = empreendimentos.find((emp) => emp._id === selectedEmpreendimento);
      if (!empreendimento?.folderId) throw new Error("Empreendimento sem pasta no Drive");

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("file", file);
        console.log(`Adicionando arquivo ao formData: ${file.name}`); // Log para depuração
      });
      formData.append("folderId", empreendimento.folderId);
      formData.append("empreendimentoId", selectedEmpreendimento);
      formData.append("category", category || "Outros");
      formData.append("saveReference", "true");

      const response = await fetch("/api/drive/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Falha ao fazer upload dos arquivos");

      const data = await response.json();
      console.log(`Arquivos enviados: ${data.files.length}`); // Log para depuração
      toast({
        title: "Arquivos enviados",
        description: `Foram enviados ${data.files.length} arquivo(s) com sucesso`,
      });

      setFiles([]);
      setSelectedEmpreendimento("");
      setCategory("");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao fazer upload dos arquivos",
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Upload de Documentos</h2>
        <p className="text-muted-foreground">Faça upload de documentos relacionados aos empreendimentos</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1">Empreendimento</label>
                <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o empreendimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {empreendimentos.map((emp) => (
                      <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Documentos Jurídicos">Documentos Jurídicos</SelectItem>
                    <SelectItem value="Plantas e Projetos">Plantas e Projetos</SelectItem>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                    <SelectItem value="Contratos">Contratos</SelectItem>
                    <SelectItem value="Fotos">Fotos</SelectItem>
                    <SelectItem value="Relatórios">Relatórios</SelectItem>
                    <SelectItem value="Despesas">Despesas</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1">Arquivos</label>
                <Card>
                  <CardContent className="p-4">
                    <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">
                        Arraste e solte arquivos aqui ou clique para selecionar
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Suporta imagens, PDFs, DOCs e planilhas (máx. 10MB)
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <label htmlFor="file-upload" className="cursor-pointer">
                          Selecionar Arquivos
                          <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                        </label>
                      </Button>
                    </div>

                    {files.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">Arquivos selecionados ({files.length})</p>
                        <div className="space-y-2">
                          {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(index)}>
                                <X className="h-4 w-4" />
                                <span className="sr-only">Remover</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? "Enviando..." : "Enviar Documentos"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}