// Why: Ask and Search open the same way, so the rules live once. On a desk the panel docks on the right as
// a non-modal dialog and the page narrows beside it, still readable and still usable; on a phone it covers
// the screen as a modal dialog. Escape closes it, focus goes back to the button that opened it, and only one
// panel is open at a time.
import { useCallback, useEffect, useRef, useState } from 'react';

const NARROW = '(max-width: 64rem)';

export interface Dock {
  dialog: React.RefObject<HTMLDialogElement | null>;
  trigger: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  open: () => void;
  close: (returnFocus?: boolean) => void;
  /** Spread onto the <dialog>: Escape closes it whether it is modal or not. */
  dialogProps: {
    onCancel: (event: React.SyntheticEvent) => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
  };
}

export function useDock(name: 'ask' | 'search'): Dock {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [isOpen, setOpen] = useState(false);

  const close = useCallback(
    (returnFocus = true): void => {
      const d = dialog.current;
      if (!d?.open) return;
      d.close();
      setOpen(false);
      if (document.documentElement.getAttribute('data-dock') === name)
        document.documentElement.removeAttribute('data-dock');
      if (returnFocus) trigger.current?.focus();
    },
    [name],
  );

  const open = useCallback((): void => {
    const d = dialog.current;
    if (!d) return;
    dispatchEvent(new CustomEvent('dock:open', { detail: name }));
    if (!d.open) {
      if (matchMedia(NARROW).matches) d.showModal();
      else d.show();
    }
    document.documentElement.setAttribute('data-dock', name);
    setOpen(true);
  }, [name]);

  // Opening one panel closes the other.
  useEffect(() => {
    const onOther = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail !== name) close(false);
    };
    addEventListener('dock:open', onOther);
    return () => {
      removeEventListener('dock:open', onOther);
    };
  }, [name, close]);

  const dialogProps = {
    onCancel: (event: React.SyntheticEvent): void => {
      event.preventDefault();
      close();
    },
    onKeyDown: (event: React.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    },
  };

  return { dialog, trigger, isOpen, open, close, dialogProps };
}
