// contexts/NotificationContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

// --- Tipos ---
interface NotificationSummary {
    unreadCount: number;
}

interface NotificationContextProps {
    unreadCount: number;
    isLoading: boolean;
    readIds: Set<string>; // <-- Adicionado: expor o estado dos IDs lidos
    fetchNotifications: () => void;
    markAsRead: (id: string) => void;
    markAllAsRead: (ids: string[]) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'readNotificationIds';

// --- Funções Auxiliares localStorage (permanecem internas) ---
const getReadIdsInternal = (): Set<string> => { // Renomeado para evitar conflito
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    try {
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
        console.error("Falha ao ler readNotificationIds:", e);
        return new Set();
    }
};

const addReadIdInternal = (id: string) => { // Renomeado
    if (typeof window === 'undefined') return false;
    const currentIds = getReadIdsInternal();
    if (!currentIds.has(id)) {
        currentIds.add(id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(currentIds)));
        return true;
    }
    return false;
};

const addMultipleReadIdsInternal = (ids: string[]) => { // Renomeado
    if (typeof window === 'undefined' || ids.length === 0) return false;
    const currentIds = getReadIdsInternal();
    let changed = false;
    ids.forEach(id => {
        if (!currentIds.has(id)) {
            currentIds.add(id);
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(currentIds)));
    }
    return changed;
};


// --- Provedor ---
export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const { data: session, status } = useSession();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [readIds, setReadIds] = useState<Set<string>>(new Set()); // <- Estado gerenciado aqui

    // Carrega IDs lidos do localStorage na montagem inicial
    useEffect(() => {
        setReadIds(getReadIdsInternal()); // Usa a função interna
    }, []);

    // Função de busca (inalterada)
    const fetchNotifications = useCallback(async () => {
        if (status !== 'authenticated') {
           setIsLoading(false);
           setUnreadCount(0);
           return;
        }
        setIsLoading(true);
        try {
            const response = await fetch('/api/notifications/summary');
            if (!response.ok) {
                 if (response.status === 401) { console.warn("Não autorizado a buscar notificações."); setUnreadCount(0); return; }
                 throw new Error(`Falha ao buscar sumário (${response.status})`);
            }
            const data: NotificationSummary = await response.json();
            const totalRelevantCount = data.unreadCount || 0;
            setUnreadCount(totalRelevantCount); // API já filtra, simplificado

        } catch (error) { console.error("Erro no fetchNotifications:", error); setUnreadCount(0); }
        finally { setIsLoading(false); }
    }, [status]);

    // Busca inicial e periódica (inalterada)
    useEffect(() => {
        if (status === 'authenticated') {
             fetchNotifications();
            const intervalId = setInterval(fetchNotifications, 5 * 60 * 1000);
            return () => clearInterval(intervalId);
        } else if (status === 'unauthenticated'){
             setUnreadCount(0);
             setIsLoading(false);
        }
    }, [status, fetchNotifications]);

    // Funções para marcar como lido (atualiza localStorage e estado local `readIds`)
    const markAsRead = useCallback((id: string) => {
        if (addReadIdInternal(id)) { // Usa a função interna
            setReadIds(prev => new Set(prev).add(id)); // Atualiza o estado local
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, []);

    const markAllAsRead = useCallback((ids: string[]) => {
       if (addMultipleReadIdsInternal(ids)) { // Usa a função interna
           setReadIds(prev => new Set([...prev, ...ids])); // Atualiza o estado local
           setUnreadCount(0);
       }
    }, []);


    const value = useMemo(() => ({
        unreadCount,
        isLoading,
        readIds, // <-- Incluído no valor do contexto
        fetchNotifications,
        markAsRead,
        markAllAsRead,
    }), [unreadCount, isLoading, readIds, fetchNotifications, markAsRead, markAllAsRead]); // Adicionado readIds

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

// --- Hook (inalterado) ---
export const useNotifications = (): NotificationContextProps => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};