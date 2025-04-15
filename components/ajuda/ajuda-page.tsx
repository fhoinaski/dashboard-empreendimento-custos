// components/ajuda/ajuda-page.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link"; // Importar Link
import {
  Search, HelpCircle, Book, MessageSquare, FileText, ExternalLink, Mail, Phone,
  Building, Receipt, BarChart3, Calendar, Settings, Users, ShieldCheck, Server, FileUp // Icons específicos
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils"; // Import cn

export default function AjudaPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast(); // Mantido, embora o formulário de suporte seja removido

  // Animation variants (mantidos)
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
  };

  // --- FAQ Items Atualizados ---
  const faqItems = [
    // Geral & Acesso
    { question: "Como faço login no sistema?", answer: "Na página inicial, insira seu email e senha cadastrados e clique em 'Entrar'. Se esqueceu a senha, utilize a opção correspondente (se disponível)." },
    { question: "Como alterar minha senha?", answer: "Acesse 'Configurações' no menu lateral, vá para a seção 'Perfil' e procure a opção 'Alterar Senha'. Você precisará informar sua senha atual e a nova senha desejada." },
    { question: "O que cada nível de usuário (Admin, Manager, User) pode fazer?", answer: "Admin tem acesso total. Manager gerencia empreendimentos e despesas associadas. User geralmente visualiza e gerencia despesas que criou ou de empreendimentos atribuídos. Detalhes podem variar." },

    // Empreendimentos
    { question: "Como adicionar um novo empreendimento? (Admin/Manager)", answer: "No menu 'Empreendimentos', clique em 'Novo Empreendimento'. Preencha os detalhes como nome, endereço, tipo, status, unidades, datas e responsável. Clique em 'Salvar'." },
    { question: "Como editar um empreendimento existente? (Admin)", answer: "Acesse a lista de 'Empreendimentos', clique no empreendimento desejado para ver os detalhes e, em seguida, clique no botão 'Editar'. Faça as alterações e salve." },
    { question: "Como visualizar as despesas de um empreendimento específico?", answer: "Vá para 'Empreendimentos', encontre o desejado na lista ou grade, clique nele para ver os detalhes e acesse a aba/seção 'Despesas'. Alternativamente, use os filtros na página principal de 'Despesas'." },
    { question: "O que significa 'Setup Drive Pendente'?", answer: "Significa que a estrutura de pastas no Google Drive para armazenar documentos deste empreendimento ainda não foi criada. Um administrador pode fazer isso na página de detalhes do empreendimento."},

    // Despesas
    { question: "Como registrar uma nova despesa?", answer: "Vá para 'Despesas' e clique em 'Nova Despesa'. Selecione o empreendimento, preencha descrição, valor, datas, categoria e status. Anexos são opcionais. Salve o formulário." },
    { question: "Como editar uma despesa?", answer: "Encontre a despesa na lista, clique para ver os detalhes e use o botão 'Editar'. Modifique os campos necessários e salve. *Nota: A edição pode ser restrita dependendo do status de aprovação e do seu nível de permissão.*" },
    { question: "Como funciona a aprovação de despesas? (Admin)", answer: "Despesas criadas por usuários 'User' ou 'Manager' podem requerer aprovação de um 'Admin'. O Admin pode aprovar ou rejeitar a despesa na tela de detalhes da mesma ou através de notificações." },
    { question: "Como anexar um comprovante a uma despesa?", answer: "Ao criar ou editar uma despesa, utilize a seção 'Anexo'. Selecione o arquivo do seu computador. O sistema fará o upload para a pasta correspondente no Google Drive." },
    { question: "Como marcar uma despesa como 'Paga'?", answer: "Na lista de despesas ou na tela de detalhes, localize a despesa 'A vencer' ou 'Pendente' e clique no botão de check (✓) ou na opção 'Marcar como Pago'." },

    // Documentos
    { question: "Como fazer upload de documentos para um empreendimento? (Admin/Manager)", answer: "Acesse a página 'Documentos' ou a aba 'Documentos' nos detalhes de um empreendimento. Selecione o empreendimento, a categoria e escolha os arquivos para upload. O sistema os enviará para a pasta correta no Google Drive." },
    { question: "Onde os documentos são armazenados?", answer: "Os arquivos são armazenados no Google Drive, em pastas organizadas por empreendimento e categoria. O sistema apenas guarda a referência (link) para eles." },

    // Relatórios (Admin)
    { question: "Como gerar relatórios?", answer: "Acesse a seção 'Relatórios'. Utilize os filtros de período e empreendimento para refinar os dados. Explore as diferentes abas (Dashboard, Despesas, Categorias, Tendências, Comparativo) para visualizar as análises." },
    { question: "Posso exportar os relatórios?", answer: "Sim, na página de relatórios, geralmente há opções para exportar os dados visualizados em formatos como Excel (CSV) ou PDF." },

    // Configurações
    { question: "Como configurar minhas notificações?", answer: "Vá para 'Configurações' > 'Notificações'. Ative ou desative os tipos de alerta que deseja receber por email ou no sistema (ícone de sino)." },
    { question: "Como um Admin gerencia usuários?", answer: "Em 'Configurações' > 'Usuários', o Admin pode adicionar novos usuários (definindo nome, email, senha e função), editar informações (nome, função, empreendimentos atribuídos) e alterar senhas ou excluir usuários existentes." },
    { question: "Para que servem as 'Integrações' (Chaves API)? (Admin)", answer: "Esta seção permite configurar chaves de API para serviços externos como Google Drive (upload de arquivos) e AWS S3 (upload de imagens, como logos). É essencial para o funcionamento completo de certas funcionalidades." },
    { question: "Como funciona o Backup? (Admin)", answer: "Em 'Configurações' > 'Backup', o Admin pode gerar um backup dos dados principais do sistema em formato CSV para download local. A opção de salvar no Drive pode estar em desenvolvimento." },
  ];

  // Filtered FAQ items based on search term
  const filteredFaqItems = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-bold tracking-tight">Central de Ajuda</h2>
        <p className="text-muted-foreground">Encontre respostas para suas dúvidas e obtenha suporte.</p>
      </motion.div>

      {/* Search Bar */}
      <motion.div variants={itemVariants} className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por dúvidas frequentes..."
          className="pl-8 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Buscar na Central de Ajuda"
        />
      </motion.div>

      <Tabs defaultValue="faq" className="space-y-4">
        <motion.div variants={itemVariants}>
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="faq" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <HelpCircle className="h-4 w-4" /> FAQs
            </TabsTrigger>
            <TabsTrigger value="guides" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Book className="h-4 w-4" /> Guias Rápidos
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <MessageSquare className="h-4 w-4" /> Suporte
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="mt-0">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Perguntas Frequentes</CardTitle>
                <CardDescription>Respostas para as dúvidas mais comuns sobre o sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredFaqItems.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {filteredFaqItems.map((item, index) => (
                      <AccordionItem key={index} value={`item-${index}`}>
                        <AccordionTrigger className="text-left hover:no-underline">{item.question}</AccordionTrigger>
                        <AccordionContent>
                          <p className="text-muted-foreground">{item.answer}</p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Nenhum resultado encontrado</h3>
                    <p className="text-muted-foreground mt-1">
                      Não encontramos FAQs para "{searchTerm}". Tente outros termos ou verifique os Guias Rápidos.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Guias Tab */}
        <TabsContent value="guides" className="mt-0 space-y-4">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Guias Rápidos</CardTitle>
                <CardDescription>Links úteis para as principais seções do sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Link para Empreendimentos */}
                  <Card className="border border-muted hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5" /> Empreendimentos</CardTitle></CardHeader>
                    <CardContent className="pb-3"><p className="text-sm text-muted-foreground">Gerencie seus projetos imobiliários.</p></CardContent>
                    <CardFooter><Button variant="outline" className="w-full" asChild><Link href="/dashboard/empreendimentos"><FileText className="mr-2 h-4 w-4" /> Acessar</Link></Button></CardFooter>
                  </Card>
                  {/* Link para Despesas */}
                  <Card className="border border-muted hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-5 w-5" /> Despesas</CardTitle></CardHeader>
                    <CardContent className="pb-3"><p className="text-sm text-muted-foreground">Registre e controle gastos e pagamentos.</p></CardContent>
                    <CardFooter><Button variant="outline" className="w-full" asChild><Link href="/dashboard/despesas"><FileText className="mr-2 h-4 w-4" /> Acessar</Link></Button></CardFooter>
                  </Card>
                  {/* Link para Calendário */}
                  <Card className="border border-muted hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Calendário</CardTitle></CardHeader>
                    <CardContent className="pb-3"><p className="text-sm text-muted-foreground">Visualize vencimentos e eventos.</p></CardContent>
                    <CardFooter><Button variant="outline" className="w-full" asChild><Link href="/dashboard/calendario"><FileText className="mr-2 h-4 w-4" /> Acessar</Link></Button></CardFooter>
                  </Card>
                  {/* Link para Documentos */}
                   <Card className="border border-muted hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><FileUp className="h-5 w-5" /> Documentos</CardTitle></CardHeader>
                      <CardContent className="pb-3"><p className="text-sm text-muted-foreground">Faça upload e gerencie arquivos.</p></CardContent>
                      <CardFooter><Button variant="outline" className="w-full" asChild><Link href="/dashboard/documentos"><FileText className="mr-2 h-4 w-4" /> Acessar</Link></Button></CardFooter>
                    </Card>
                  {/* Link para Relatórios */}
                  <Card className="border border-muted hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Relatórios</CardTitle></CardHeader>
                    <CardContent className="pb-3"><p className="text-sm text-muted-foreground">Analise dados e visualize gráficos (Admin).</p></CardContent>
                    <CardFooter><Button variant="outline" className="w-full" asChild><Link href="/dashboard/relatorios"><FileText className="mr-2 h-4 w-4" /> Acessar</Link></Button></CardFooter>
                  </Card>
                  {/* Link para Configurações */}
                  <Card className="border border-muted hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Settings className="h-5 w-5" /> Configurações</CardTitle></CardHeader>
                    <CardContent className="pb-3"><p className="text-sm text-muted-foreground">Ajuste seu perfil, notificações e mais.</p></CardContent>
                    <CardFooter><Button variant="outline" className="w-full" asChild><Link href="/dashboard/configuracoes"><FileText className="mr-2 h-4 w-4" /> Acessar</Link></Button></CardFooter>
                  </Card>
                </div>

                {/* Placeholder Vídeos */}
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-lg font-medium mb-4">Vídeos Tutoriais (Exemplo)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg overflow-hidden bg-muted/30">
                      <div className="aspect-video bg-muted flex items-center justify-center"> <FileText className="h-12 w-12 text-muted-foreground opacity-50" /> </div>
                      <div className="p-4"> <h4 className="font-medium">Introdução ao Sistema</h4> <p className="text-sm text-muted-foreground mt-1">Visão geral das funcionalidades.</p> <Button variant="link" className="px-0 mt-2 text-muted-foreground cursor-not-allowed" disabled> <ExternalLink className="mr-2 h-4 w-4" /> Vídeo em breve </Button> </div>
                    </div>
                     <div className="border rounded-lg overflow-hidden bg-muted/30">
                      <div className="aspect-video bg-muted flex items-center justify-center"> <FileText className="h-12 w-12 text-muted-foreground opacity-50" /> </div>
                      <div className="p-4"> <h4 className="font-medium">Gerenciando Despesas</h4> <p className="text-sm text-muted-foreground mt-1">Como criar e acompanhar despesas.</p> <Button variant="link" className="px-0 mt-2 text-muted-foreground cursor-not-allowed" disabled> <ExternalLink className="mr-2 h-4 w-4" /> Vídeo em breve </Button> </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Suporte Tab */}
        <TabsContent value="support" className="mt-0">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Suporte Técnico</CardTitle>
                <CardDescription>Precisa de ajuda adicional? Entre em contato conosco.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Informações de Contato */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Entre em Contato</h3>
                    <div className="space-y-3">
                       <div className="flex items-start gap-3">
                           <Mail className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0"/>
                           <div>
                               <span className="text-sm font-medium">Email de Suporte</span>
                               <a href="mailto:suporte@gestaosconstruct.com" className="block text-primary hover:underline">suporte@gestaosconstruct.com</a>
                           </div>
                       </div>
                        <div className="flex items-start gap-3">
                            <Phone className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0"/>
                            <div>
                                <span className="text-sm font-medium">Telefone</span>
                                <p className="text-muted-foreground">(XX) XXXX-XXXX</p> {/* Substituir pelo telefone real */}
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                           <HelpCircle className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0"/>
                           <div>
                               <span className="text-sm font-medium">Horário de Atendimento</span>
                               <p className="text-muted-foreground">Segunda a Sexta, 9h às 18h (horário de Brasília)</p>
                           </div>
                       </div>
                    </div>
                     <Button asChild className="mt-4">
                        <a href="mailto:suporte@gestaosconstruct.com">
                            <Mail className="mr-2 h-4 w-4"/> Enviar Email
                        </a>
                     </Button>
                  </div>

                  {/* FAQ Rápido */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Dúvidas Comuns</h3>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="faq-1">
                        <AccordionTrigger className="text-left text-sm hover:no-underline">Esqueci minha senha. Como recuperar?</AccordionTrigger>
                        <AccordionContent><p className="text-sm text-muted-foreground">Na tela de login, procure pela opção "Esqueci minha senha" (se disponível) ou entre em contato com o administrador do sistema.</p></AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="faq-2">
                        <AccordionTrigger className="text-left text-sm hover:no-underline">O sistema parece lento, o que fazer?</AccordionTrigger>
                        <AccordionContent><p className="text-sm text-muted-foreground">Verifique sua conexão com a internet. Tente limpar o cache do seu navegador ou utilizar uma janela anônima. Se o problema persistir, informe nossa equipe de suporte.</p></AccordionContent>
                      </AccordionItem>
                       <AccordionItem value="faq-3">
                        <AccordionTrigger className="text-left text-sm hover:no-underline">Como sugerir uma nova funcionalidade?</AccordionTrigger>
                        <AccordionContent><p className="text-sm text-muted-foreground">Adoramos ouvir suas ideias! Envie sua sugestão para nosso email de suporte com o assunto "Sugestão de Funcionalidade".</p></AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}