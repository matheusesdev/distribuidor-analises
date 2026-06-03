import { useState, useCallback } from 'react';
import { normalizeUiText } from '../utils/textEncoding';

export function useToast() {
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const notify = useCallback((message, type = 'success') => {
    const safeMessage = normalizeUiText(message);
    setToast({ show: true, message: safeMessage, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  }, []);

  return { toast, notify };
}
