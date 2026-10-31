'use client';

import { useEffect } from 'react';

interface KeyboardNavigationOptions {
  onPrevPlanet: () => void;
  onNextPlanet: () => void;
  onToggleViewMode: () => void;
}

/**
 * Provides accessible keyboard navigation shortcuts when focus is not inside a text input:
 * - '[' : Focus previous song planet
 * - ']' : Focus next song planet
 * - 'v' : Toggle between 3D Galaxy view and 2D Accessible view
 */
export function useKeyboardNavigation({
  onPrevPlanet,
  onNextPlanet,
  onToggleViewMode,
}: KeyboardNavigationOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        onPrevPlanet();
      } else if (e.key === ']') {
        e.preventDefault();
        onNextPlanet();
      } else if (e.key.toLowerCase() === 'v' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleViewMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevPlanet, onNextPlanet, onToggleViewMode]);
}
