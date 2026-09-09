/** Preserve native input/button behavior and never repeat a held-down progress key. */
export function isSpaceShortcut(event: KeyboardEvent) {
  if (
    event.code !== 'Space' ||
    event.repeat ||
    event.isComposing ||
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  )
    return false;
  const target = event.target instanceof Element ? event.target : null;
  return !target?.closest(
    'input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="tab"],[role="combobox"],[role="listbox"],[role="option"],[role="slider"],[role="switch"],[role="checkbox"],[role="menuitem"]',
  );
}
