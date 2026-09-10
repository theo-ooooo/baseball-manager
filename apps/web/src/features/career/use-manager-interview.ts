import { useRef, useState } from 'react';
import type { Act } from './game-contracts';

export function useManagerInterview(act: Act, busy: boolean) {
  const [selected, setSelected] = useState('');
  const submitting = useRef(false);
  async function answer(id: string, question: string) {
    if (busy || submitting.current || !selected) return;
    submitting.current = true;
    try {
      if (await act({ type: 'managerInterview', id, question, answer: selected })) setSelected('');
    } finally {
      submitting.current = false;
    }
  }
  return { selected, setSelected, answer };
}
