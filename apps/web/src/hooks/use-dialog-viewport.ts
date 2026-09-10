'use client';
import { useEffect } from 'react';
export function useDialogViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--dialog-height', `${viewport?.height ?? window.innerHeight}px`);
      root.style.setProperty('--dialog-top', `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      root.style.removeProperty('--dialog-height');
      root.style.removeProperty('--dialog-top');
    };
  }, []);
}
