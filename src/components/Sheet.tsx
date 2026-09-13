"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="glass-strong fixed inset-x-0 bottom-0 z-[81] mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:rounded-3xl"
            role="dialog"
            aria-modal
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">{title}</h3>
                <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-white/10 hover:text-white" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
