 // Interface para dados de arquivo comuns
 export interface FileData {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
}

// Interface para resultado de upload de arquivo
export interface UploadResult {
    success: boolean;
    fileId?: string; // ID no provedor (Drive ID, S3 Key, etc.)
    fileName?: string; // Nome final do arquivo no storage
    url?: string; // URL pública ou de visualização
    error?: string;
}

// Interface para resultado de criação de pasta
export interface CreateFolderResult {
    success: boolean;
    folderId?: string;
    error?: string;
}

// Interface para resultado de sincronização (ex: Sheets)
export interface SyncResult {
    success: boolean;
    details?: any; // Detalhes específicos (e.g., range atualizado)
    error?: string;
    updatedRange?: string | null; // Or adjust based on your actual needs
}

// Interface comum para serviços de integração
export interface IntegrationService {
    /**
     * Faz upload de um arquivo para o serviço.
     * @param tenantId ID do tenant para buscar configurações.
     * @param file Dados do arquivo.
     * @param destinationIdentifier Identificador do destino (e.g., folderId no Drive).
     * @param options Opções adicionais (e.g., categoria).
     */
    uploadFile(
        tenantId: string,
        file: FileData,
        destinationIdentifier: string,
        options?: Record<string, any>
    ): Promise<UploadResult>;

    /**
     * Cria uma estrutura de pastas base (ex: para um empreendimento).
     * @param tenantId ID do tenant.
     * @param name Nome base para a pasta principal.
     * @param parentIdentifier Opcional: ID da pasta pai.
     */
    createFolderStructure?(
        tenantId: string,
        name: string,
        parentIdentifier?: string
    ): Promise<CreateFolderResult & { categoryFolders?: Record<string, string> }>; // Drive needs categoryFolders

    /**
     * Adiciona uma linha de dados a um recurso (ex: Planilha).
     * @param tenantId ID do tenant.
     * @param resourceIdentifier ID do recurso (e.g., spreadsheetId).
     * @param data Dados da linha.
     * @param options Opções (e.g., sheetName).
     */
    addRow?(
        tenantId: string,
        resourceIdentifier: string,
        data: any[],
        options?: Record<string, any>
    ): Promise<SyncResult>;

    /**
     * Atualiza uma linha de dados em um recurso.
     * @param tenantId ID do tenant.
     * @param resourceIdentifier ID do recurso.
     * @param uniqueRowId ID único da linha a ser atualizada.
     * @param data Novos dados da linha.
     * @param options Opções (e.g., sheetName, idColumnLetter).
     */
    updateRow?(
        tenantId: string,
        resourceIdentifier: string,
        uniqueRowId: string,
        data: any[],
        options?: Record<string, any>
    ): Promise<SyncResult>;

    /**
     * Exclui um arquivo/recurso.
     * @param tenantId ID do tenant.
     * @param fileOrResourceId ID do arquivo ou recurso a ser excluído.
     */
    deleteFileOrResource?(
        tenantId: string,
        fileOrResourceId: string
    ): Promise<{ success: boolean; error?: string }>;

   
}