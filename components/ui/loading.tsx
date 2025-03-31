"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Loading({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm z-50",
        className
      )}
    >
      <div className="relative flex flex-col items-center">
        {/* Animação de ondas concêntricas */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.8, 0.4, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-primary/20"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.6, 0.3, 0.6],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.2,
          }}
          className="absolute h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/30"
        />
        {/* Círculo central com rotação e pulso */}
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 1.2, repeat: Infinity, ease: "linear" },
            scale: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
          }}
          className="h-12 w-12 sm:h-16 sm:w-16 rounded-full border-4 border-primary border-t-transparent"
        />
        {/* Texto com animação */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="mt-6 text-sm sm:text-base font-medium text-primary"
        >
          Carregando
        </motion.p>
      </div>
    </motion.div>
  );
}