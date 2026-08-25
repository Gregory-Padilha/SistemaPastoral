import React, { createContext, useContext, useState } from 'react'

const FeedbackContext = createContext({
  showToast: (title, description, type = 'success') => {},
  confirmDelete: (title, description, onConfirm) => {},
})

export const FeedbackProvider = ({ children }) => {
  const [toast, setToast] = useState({ show: false, title: '', description: '', type: 'success' })
  const [confirm, setConfirm] = useState({ show: false, title: '', description: '', onConfirm: null })

  const showToast = (title, description, type = 'success') => {
    setToast({ show: true, title, description, type })
    // Auto close after 5 seconds
    setTimeout(() => {
      setToast(prev => prev.title === title ? { ...prev, show: false } : prev)
    }, 5000)
  }

  const confirmDelete = (title, description, onConfirm) => {
    setConfirm({
      show: true,
      title,
      description,
      onConfirm: () => {
        onConfirm()
        setConfirm({ show: false, title: '', description: '', onConfirm: null })
      }
    })
  }

  const handleCancel = () => {
    setConfirm({ show: false, title: '', description: '', onConfirm: null })
  }

  return (
    <FeedbackContext.Provider value={{ showToast, confirmDelete }}>
      {children}

      {/* Global Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-50 flex items-start gap-3 p-4 rounded-xl shadow-lg w-full max-w-sm border transition-all duration-300 transform translate-y-0 ${
          toast.type === 'error'
            ? 'bg-red-50 text-red-900 border-red-200'
            : 'bg-green-50 text-green-900 border-green-200'
        }`}>
          <span className={`material-symbols-outlined shrink-0 text-[24px] ${
            toast.type === 'error' ? 'text-red-600' : 'text-green-600'
          }`}>
            {toast.type === 'error' ? 'report' : 'check_circle'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight">{toast.title}</p>
            {toast.description && (
              <p className="text-xs text-slate-600 mt-1 leading-normal">{toast.description}</p>
            )}
          </div>
          <button 
            onClick={() => setToast(prev => ({ ...prev, show: false }))}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Global Delete Confirmation Modal */}
      {confirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={handleCancel}></div>
          
          {/* Modal Container */}
          <div className="relative bg-surface w-full max-w-md rounded-xl shadow-2xl border border-surface-variant p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-error-container/20 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">delete_forever</span>
              </div>
              <div className="flex-1">
                <h3 className="font-headline-md text-on-surface font-semibold text-lg">{confirm.title}</h3>
                <p className="text-body-sm text-on-surface-variant mt-2 leading-relaxed">{confirm.description}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4 mt-2">
              <button 
                type="button" 
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-lg border border-outline text-on-surface hover:bg-surface-container font-semibold text-body-sm transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={confirm.onConfirm}
                className="px-5 py-2.5 rounded-lg bg-error text-on-error hover:bg-error/90 font-semibold text-body-sm transition-colors shadow-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

export const useFeedback = () => {
  const context = useContext(FeedbackContext)
  if (context === undefined) {
    throw new Error('useFeedback must be used within a FeedbackProvider')
  }
  return context
}
