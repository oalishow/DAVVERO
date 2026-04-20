import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmVariant?: 'primary' | 'danger' | 'success';
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  confirmLabel, 
  onConfirm,
  confirmVariant = 'primary'
}: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 no-print">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter shrink-0">{title}</h3>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                {children}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {onConfirm ? 'Cancelar' : 'Fechar'}
                </button>
                
                {onConfirm && (
                  <button 
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white transition-all shadow-lg active:scale-95 ${
                      confirmVariant === 'danger' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20' : 
                      confirmVariant === 'success' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 
                      'bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 shadow-slate-900/20 dark:shadow-sky-600/20'
                    }`}
                  >
                    {confirmLabel || 'Confirmar'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
