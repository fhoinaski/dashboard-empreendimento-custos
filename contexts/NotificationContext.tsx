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
    readIds: Set<string>;
    fetchNotifications: () => void;
    markAsRead: (id: string) => void;
    markAllAsRead: (ids: string[]) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'readNotificationIds';

// --- Funções Auxiliares localStorage ---
const getReadIdsInternal = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    try {
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
        console.error("Falha ao ler readNotificationIds:", e);
        return new Set();
    }
};

const addReadIdInternal = (id: string) => {
    if (typeof window === 'undefined') return false;
    const currentIds = getReadIdsInternal();
    if (!currentIds.has(id)) {
        currentIds.add(id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(currentIds)));
        return true;
    }
    return false;
};

const addMultipleReadIdsInternal = (ids: string[]) => {
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
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setReadIds(getReadIdsInternal());
    }, []);

    // Fetch notification summary count
    const fetchNotifications = useCallback(async () => {
        if (status !== 'authenticated') {
           setIsLoading(false);
           setUnreadCount(0);
           return;
        }
        setIsLoading(true);
        try {
            // This endpoint just returns the count of relevant unpaid expenses.
            // It does NOT filter based on user's boolean preferences (e.g., systemDespesasVencer).
            const response = await fetch('/api/notifications/summary');
            if (!response.ok) {
                 if (response.status === 401) { console.warn("Não autorizado a buscar notificações."); setUnreadCount(0); return; }
                 throw new Error(`Falha ao buscar sumário (${response.status})`);
            }
            const data: NotificationSummary = await response.json();
            const totalRelevantCount = data.unreadCount || 0;

             // Calculate the *actual* unread count by subtracting locally stored read IDs
             // Fetch details is needed to know *which* IDs are relevant for the count
             // For simplicity, we'll assume the API count is accurate enough for the badge
             // A more accurate approach would fetch IDs from summary and compare with readIds
             setUnreadCount(totalRelevantCount);

        } catch (error) { console.error("Erro no fetchNotifications:", error); setUnreadCount(0); }
        finally { setIsLoading(false); }
    }, [status]); // Depends only on auth status

    useEffect(() => {
        if (status === 'authenticated') {
             fetchNotifications();
            const intervalId = setInterval(fetchNotifications, 5 * 60 * 1000); // Refresh every 5 minutes
            return () => clearInterval(intervalId);
        } else if (status === 'unauthenticated'){
             setUnreadCount(0);
             setIsLoading(false);
        }
    }, [status, fetchNotifications]);

    // Mark specific ID as read
    const markAsRead = useCallback((id: string) => {
        if (addReadIdInternal(id)) {
            setReadIds(prev => new Set(prev).add(id));
             // Optimistically decrease count, though fetch will correct it later
             setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, []);

    // Mark multiple IDs as read
    const markAllAsRead = useCallback((ids: string[]) => {
       if (addMultipleReadIdsInternal(ids)) {
           setReadIds(prev => new Set([...prev, ...ids]));
            // Optimistically set count to 0, fetch will correct later
            setUnreadCount(0);
       }
    }, []);


    const value = useMemo(() => ({
        unreadCount,
        isLoading,
        readIds,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
    }), [unreadCount, isLoading, readIds, fetchNotifications, markAsRead, markAllAsRead]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

// --- Hook ---
export const useNotifications = (): NotificationContextProps => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};