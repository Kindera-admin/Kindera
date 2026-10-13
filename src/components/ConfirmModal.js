'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useId, useState } from 'react';
import { useDialogA11y } from '@/hooks/useDialogA11y';

// confirmPhrase: for critical actions, a second step. The confirm button stays
// disabled until the user types this phrase exactly (usually the item's name).
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  isDestructive = true,
  isLoading = false,
  confirmPhrase = '',
}) {
  const [typed, setTyped] = useState('');

  // Prevent body scroll when open, and start every opening with an empty box
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setTyped('');
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const titleId = useId();
  const messageId = useId();
  const phraseId = useId();
  const panelRef = useDialogA11y(isOpen, () => !isLoading && onClose());

  if (!isOpen) return null;

  const phrase = String(confirmPhrase || '').trim();
  const phraseOk = !phrase || typed.trim() === phrase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => !isLoading && onClose()}
      />

      {/* Modal */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200 outline-none"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="flex-1 pt-1 min-w-0">
              <h3 id={titleId} className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
              <p id={messageId} className="text-gray-600 text-sm leading-relaxed">
                {message}
              </p>
              {phrase && (
                <div className="mt-4">
                  <label htmlFor={phraseId} className="block text-sm text-gray-700 mb-1.5">
                    To confirm, type <strong className="font-semibold text-gray-900 break-all">{phrase}</strong>
                  </label>
                  <input
                    id={phraseId}
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isLoading}
                    className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50/80 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="bg-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !phraseOk}
            className={isDestructive ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
