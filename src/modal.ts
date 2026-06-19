const overlay = document.getElementById('confirm-modal') as HTMLElement;
const titleEl = document.getElementById('confirm-modal-title') as HTMLElement;
const messageEl = document.getElementById('confirm-modal-message') as HTMLElement;
const btnConfirm = document.getElementById('confirm-modal-confirm') as HTMLButtonElement;
const btnCancel = document.getElementById('confirm-modal-cancel') as HTMLButtonElement;

let resolveCurrent: ((value: boolean) => void) | null = null;

function close(result: boolean): void {
  overlay.classList.add('hidden');
  overlay.classList.remove('visible');
  if (resolveCurrent) {
    resolveCurrent(result);
    resolveCurrent = null;
  }
}

export function confirmModal(title: string, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  titleEl.textContent = title;
  messageEl.textContent = message;
  btnConfirm.textContent = confirmLabel;
  btnCancel.textContent = cancelLabel;
  overlay.classList.remove('hidden');
  // Force a reflow so the opacity transition fires after display:none is removed
  overlay.getBoundingClientRect();
  overlay.classList.add('visible');
  return new Promise((resolve) => {
    resolveCurrent = resolve;
  });
}

export function init(): void {
  btnConfirm.addEventListener('click', () => close(true));
  btnCancel.addEventListener('click', () => close(false));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(false);
  });
}
