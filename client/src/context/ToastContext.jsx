import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Small pop-up messages in the corner ("Session booked", errors, ...).
const ToastContext = createContext(() => {});

const TONES = {
  info: 'border-line',
  success: 'border-gold-2',
  error: 'border-ox/40',
};
const DOTS = { info: 'bg-muted', success: 'bg-gold', error: 'bg-ox' };

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    ({ title, description, tone = 'info' }) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-3), { id, title, description, tone }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto w-full rounded-xl border bg-card px-4 py-3.5 shadow-lift ${TONES[t.tone]}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOTS[t.tone]}`} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-muted hover:text-body" aria-label="Dismiss">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
