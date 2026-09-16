/** Copies text to the clipboard, returning whether it actually worked. Some embedded
 *  WebViews (older Telegram clients, some in-app browsers) deny the async Clipboard API
 *  even on a user gesture, so this falls back to the legacy execCommand technique before
 *  giving up — callers should show the caller a toast either way rather than assume success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

function legacyCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
