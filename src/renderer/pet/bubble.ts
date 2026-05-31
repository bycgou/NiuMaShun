const BUBBLE_ELEMENT_ID = 'bubble';
const HIDDEN_CLASS = 'bubble-hidden';
const DEFAULT_DURATION_MS = 3000;
const AI_DURATION_MS = 8000;

let bubbleTimer: ReturnType<typeof setTimeout> | null = null;

function getBubble(): HTMLElement | null {
  return document.getElementById(BUBBLE_ELEMENT_ID);
}

export function truncateText(text: string, maxLen: number = 60): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function hideBubble(): void {
  const el = getBubble();
  if (el) {
    el.classList.add(HIDDEN_CLASS);
  }
  if (bubbleTimer !== null) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
}

export function showBubble(text: string, durationMs: number = DEFAULT_DURATION_MS): void {
  const el = getBubble();
  if (!el) return;

  if (bubbleTimer !== null) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }

  el.textContent = truncateText(text);
  el.classList.remove(HIDDEN_CLASS);

  bubbleTimer = setTimeout(() => {
    el.classList.add(HIDDEN_CLASS);
    bubbleTimer = null;
  }, durationMs);
}

export function showAiBubble(text: string): void {
  showBubble(text, AI_DURATION_MS);
}
