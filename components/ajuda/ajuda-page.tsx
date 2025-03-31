// Adicionar o componente de ajuda que estava faltando
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Search, HelpCircle, Book, MessageSquare, FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"

export default function AjudaPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const handleContactSupport = () => {
    toast({
      title: "Mensagem enviada",
      description: "Sua mensagem foi enviada para o suporte. Responderemos em breve.",
    })
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }


  // FAQ data
  const faqItems = [
    {
      question: "Como adicionar um novo empreendimento?",
      answer:
        "Para adicionar um novo empreendimento, acesse o menu 'Empreendimentos' e clique no botão 'Novo Empreendimento'. Preencha todos os campos obrigatórios e clique em 'Salvar'.",
    },
    {
      question: "Como registrar uma nova despesa?",
      answer:
        "Para registrar uma nova despesa, acesse o menu 'Despesas' e clique no botão 'Nova Despesa'. Selecione o empreendimento relacionado, preencha os detalhes da despesa e clique em 'Salvar'.",
    },
    {
      question: "Como gerar relatórios?",
      answer:
        "Para gerar relatórios, acesse o menu 'Relatórios', selecione o período desejado e o tipo de relatório. Você pode filtrar por empreendimento e exportar os relatórios em diferentes formatos.",
    },
    {
      question: "Como adicionar um novo usuário ao sistema?",
      answer:
        "Para adicionar um novo usuário, acesse 'Configurações' > 'Usuários' e clique em 'Novo Usuário'. Preencha as informações do usuário, defina o nível de acesso e clique em 'Adicionar Usuário'.",
    },
    {
      question: "Como fazer upload de documentos?",
      answer:
        "Você pode fazer upload de documentos na página de detalhes de um empreendimento. Acesse a aba 'Documentos' e clique em 'Adicionar Documento'. Selecione o arquivo em seu computador e clique em 'Upload'.",
    },
    {
      question: "Como alterar minha senha?",
      answer:
        "Para alterar sua senha, acesse 'Configurações' > 'Perfil'. Na seção 'Alterar Senha', digite sua senha atual e a nova senha. Clique em 'Salvar Alterações' para confirmar.",
    },
    {
      question: "Como configurar notificações?",
      answer:
        "Para configurar notificações, acesse 'Configurações' > 'Notificações'. Você pode personalizar quais tipos de notificações deseja receber por email e no sistema.",
    },
    {
      question: "Como marcar uma despesa como paga?",
      answer:
        "Na lista de despesas, localize a despesa que deseja marcar como paga e clique no botão 'Marcar como pago'. Alternativamente, você pode acessar os detalhes da despesa e alterar seu status.",
    },
  ]

  // Filtered FAQ items based on search term
  const filteredFaqItems = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Central de Ajuda</h2>
        <p className="text-muted-foreground">Encontre respostas para suas dúvidas e obtenha suporte</p>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por dúvidas frequentes..."
          className="pl-8 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Tabs defaultValue="faq" className="space-y-4">
        <TabsList>
          <TabsTrigger value="faq" className="flex items-center">
            <HelpCircle className="mr-2 h-4 w-4" />
            Perguntas Frequentes
          </TabsTrigger>
          <TabsTrigger value="guides" className="flex items-center">
            <Book className="mr-2 h-4 w-4" />
            Guias
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center">
            <MessageSquare className="mr-2 h-4 w-4" />
            Suporte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Perguntas Frequentes</CardTitle>
              <CardDescription>Respostas para as dúvidas mais comuns</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredFaqItems.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {filteredFaqItems.map((item, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
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
                    Não encontramos resultados para sua busca. Tente termos diferentes ou entre em contato com o
                    suporte.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Guias e Tutoriais</CardTitle>
              <CardDescription>Aprenda a utilizar todas as funcionalidades do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Primeiros Passos</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Aprenda os conceitos básicos para começar a utilizar o sistema.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="#" className="flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        Ver Guia
                      </a>
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Gerenciando Empreendimentos</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Aprenda a criar, editar e gerenciar seus empreendimentos.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="#" className="flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        Ver Guia
                      </a>
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Controle de Despesas</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Aprenda a registrar e gerenciar despesas de forma eficiente.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="#" className="flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        Ver Guia
                      </a>
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Relatórios e Análises</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Aprenda a gerar e interpretar relatórios para tomada de decisões.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="#" className="flex items-center">
                        <FileText className="mr-2 h-4 w-4" />
                        Ver Guia
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">Vídeos Tutoriais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="p-4">
                      <h4 className="font-medium">Introdução ao Sistema</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Visão geral das principais funcionalidades do sistema.
                      </p>
                      <Button variant="link" className="px-0 mt-2" asChild>
                        <a href="#" className="flex items-center">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Assistir Vídeo
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="p-4">
                      <h4 className="font-medium">Gerenciamento Financeiro</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Como gerenciar despesas e controlar o fluxo financeiro.
                      </p>
                      <Button variant="link" className="px-0 mt-2" asChild>
                        <a href="#" className="flex items-center">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Assistir Vídeo
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suporte Técnico</CardTitle>
              <CardDescription>Entre em contato com nossa equipe de suporte</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Envie uma Mensagem</h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label htmlFor="subject" className="text-sm font-medium">
                        Assunto
                      </label>
                      <Input id="subject" placeholder="Ex: Problema ao adicionar empreendimento" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="message" className="text-sm font-medium">
                        Mensagem
                      </label>
                      <textarea
                        id="message"
                        rows={5}
                        className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Descreva seu problema ou dúvida em detalhes..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="attachment" className="text-sm font-medium">
                        Anexo (opcional)
                      </label>
                      <Input id="attachment" type="file" />
                    </div>
                    <Button onClick={handleContactSupport}>Enviar Mensagem</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informações de Contato</h3>
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Email de Suporte</span>
                      <span className="text-muted-foreground">suporte@gestaoimobiliaria.com</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Telefone</span>
                      <span className="text-muted-foreground">(11) 3456-7890</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Horário de Atendimento</span>
                      <span className="text-muted-foreground">Segunda a Sexta, 9h às 18h</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="text-lg font-medium">FAQ Rápido</h3>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger className="text-left text-sm">
                          Esqueci minha senha. Como recuperar?
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-muted-foreground">
                            Na tela de login, clique em &quot;Esqueci minha senha&quot; e siga as instruções enviadas para seu
                            email.
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-2">
                        <AccordionTrigger className="text-left text-sm">
                          O sistema está lento. O que fazer?
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-muted-foreground">
                            Tente limpar o cache do navegador ou usar outro navegador. Se o problema persistir, entre em
                            contato com o suporte.
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-3">
                        <AccordionTrigger className="text-left text-sm">
                          Como exportar dados do sistema?
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-muted-foreground">
                            Em cada seção (Empreendimentos, Despesas, Relatórios), você encontrará um botão &quot;Exportar&quot;
                            que permite salvar os dados em diferentes formatos.
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

