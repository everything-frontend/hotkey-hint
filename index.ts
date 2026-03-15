export interface HotkeyDefinition {
  keys: string; // e.g. "ctrl+k", "shift+?", "g then h"
  description: string;
  group?: string;
  action: () => void;
  preventDefault?: boolean;
}

export interface HotkeyHintOptions {
  triggerKey?: string; // default: "?"
  theme?: "dark" | "light" | "auto";
  position?: "center" | "bottom-right" | "bottom-left";
  title?: string;
  showOn?: "trigger" | "hold"; // hold = show while holding the triggerKey
  zIndex?: number;
}

interface ParsedKeys {
  modifiers: Set<string>;
  key: string;
  sequence?: string[]; // for "g then h" style
}

const DEFAULT_OPTIONS: Required<HotkeyHintOptions> = {
  triggerKey: "?",
  theme: "auto",
  position: "center",
  title: "Keyboard Shortcuts",
  showOn: "trigger",
  zIndex: 9999,
};

function parseKeys(keys: string): ParsedKeys {
  const lower = keys.toLowerCase().trim();
  
  // Sequence shortcut: "g then h"
  if (lower.includes(" then ")) {
    const parts = lower.split(" then ").map((p) => p.trim());
    return { modifiers: new Set(), key: parts[parts.length - 1], sequence: parts };
  }

  const parts = lower.split("+").map((p) => p.trim());
  const modifiers = new Set<string>();
  let key = "";

  for (const part of parts) {
    if (["ctrl", "control", "cmd", "meta", "alt", "shift"].includes(part)) {
      modifiers.add(part === "control" ? "ctrl" : part === "meta" ? "cmd" : part);
    } else {
      key = part;
    }
  }

  return { modifiers, key };
}

function normalizeKey(e: KeyboardEvent): string {
  return e.key.toLowerCase();
}

function modifiersMatch(e: KeyboardEvent, modifiers: Set<string>): boolean {
  const has = (m: string) => modifiers.has(m);
  const ctrl = has("ctrl") || has("control");
  const cmd = has("cmd") || has("meta");
  const alt = has("alt");
  const shift = has("shift");
  
  return (
    (ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey) &&
    (cmd ? e.metaKey || e.ctrlKey : !e.metaKey) &&
    (alt ? e.altKey : !e.altKey) &&
    (shift ? e.shiftKey : true) // shift is optional unless explicitly required
  );
}

export class HotkeyHint {
  private hotkeys: HotkeyDefinition[] = [];
  private options: Required<HotkeyHintOptions>;
  private overlayEl: HTMLElement | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private isVisible = false;
  private sequenceBuffer: string[] = [];
  private sequenceTimer: ReturnType<typeof setTimeout> | null = null;
  private boundKeydown: (e: KeyboardEvent) => void;
  private boundKeyup: (e: KeyboardEvent) => void;

  constructor(options: HotkeyHintOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.boundKeydown = this.handleKeydown.bind(this);
    this.boundKeyup = this.handleKeyup.bind(this);
    this.mount();
  }

  register(hotkey: HotkeyDefinition): this {
    this.hotkeys.push(hotkey);
    return this;
  }

  registerAll(hotkeys: HotkeyDefinition[]): this {
    hotkeys.forEach((h) => this.register(h));
    return this;
  }

  unregister(keys: string): this {
    this.hotkeys = this.hotkeys.filter((h) => h.keys !== keys);
    return this;
  }

  show(): void {
    if (this.isVisible) return;
    this.renderOverlay();
    this.isVisible = true;
  }

  hide(): void {
    if (!this.isVisible || !this.overlayEl) return;
    this.overlayEl.classList.remove("hh-visible");
    setTimeout(() => {
      if (this.overlayEl) {
        this.overlayEl.style.display = "none";
      }
      this.isVisible = false;
    }, 200);
  }

  toggle(): void {
    this.isVisible ? this.hide() : this.show();
  }

  destroy(): void {
    this.unmount();
    this.hotkeys = [];
  }

  private mount(): void {
    if (typeof window === "undefined") return;
    this.injectStyles();
    window.addEventListener("keydown", this.boundKeydown);
    window.addEventListener("keyup", this.boundKeyup);
  }

  private unmount(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", this.boundKeydown);
    window.removeEventListener("keyup", this.boundKeyup);
    this.overlayEl?.remove();
    this.styleEl?.remove();
  }

  private handleKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const isTyping =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    // Handle overlay toggle
    if (!isTyping) {
      const triggerPressed =
        e.key === this.options.triggerKey ||
        e.key === this.options.triggerKey.toUpperCase();

      if (triggerPressed && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.options.showOn === "trigger") {
          e.preventDefault();
          this.toggle();
          return;
        }
      }

      if (this.isVisible && (e.key === "Escape" || e.key === "Esc")) {
        this.hide();
        return;
      }
    }

    // Match registered hotkeys
    for (const hotkey of this.hotkeys) {
      const parsed = parseKeys(hotkey.keys);

      if (parsed.sequence) {
        // Sequence matching
        const expectedNext = parsed.sequence[this.sequenceBuffer.length];
        if (normalizeKey(e) === expectedNext && !isTyping) {
          this.sequenceBuffer.push(normalizeKey(e));
          if (this.sequenceBuffer.length === parsed.sequence.length) {
            if (hotkey.preventDefault !== false) e.preventDefault();
            hotkey.action();
            this.sequenceBuffer = [];
          } else {
            // Reset after 2s if sequence not completed
            if (this.sequenceTimer) clearTimeout(this.sequenceTimer);
            this.sequenceTimer = setTimeout(() => {
              this.sequenceBuffer = [];
            }, 2000);
          }
          return;
        }
      } else {
        // Normal shortcut matching
        if (
          !isTyping &&
          normalizeKey(e) === parsed.key &&
          modifiersMatch(e, parsed.modifiers)
        ) {
          if (hotkey.preventDefault !== false) e.preventDefault();
          hotkey.action();
          return;
        }
      }
    }
  }

  private handleKeyup(_e: KeyboardEvent): void {
    // reserved for hold-to-show in future
  }

  private getGroups(): Map<string, HotkeyDefinition[]> {
    const groups = new Map<string, HotkeyDefinition[]>();
    for (const hotkey of this.hotkeys) {
      const group = hotkey.group || "General";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(hotkey);
    }
    return groups;
  }

  private formatKeys(keys: string): string {
    const isMac =
      typeof navigator !== "undefined" &&
      /mac/i.test(navigator.platform || navigator.userAgent);

    return keys
      .split("+")
      .map((k) => {
        const key = k.trim().toLowerCase();
        const symbols: Record<string, string> = {
          ctrl: isMac ? "⌃" : "Ctrl",
          cmd: "⌘",
          meta: isMac ? "⌘" : "Win",
          alt: isMac ? "⌥" : "Alt",
          shift: "⇧",
          enter: "↵",
          escape: "Esc",
          backspace: "⌫",
          tab: "⇥",
          arrowup: "↑",
          arrowdown: "↓",
          arrowleft: "←",
          arrowright: "→",
          space: "Space",
        };
        return symbols[key] || k.trim().toUpperCase();
      })
      .join(isMac ? "" : "+");
  }

  private renderOverlay(): void {
    if (!this.overlayEl) {
      this.overlayEl = document.createElement("div");
      this.overlayEl.className = `hh-overlay hh-${this.options.theme} hh-pos-${this.options.position}`;
      this.overlayEl.style.zIndex = String(this.options.zIndex);
      this.overlayEl.addEventListener("click", (e) => {
        if (e.target === this.overlayEl) this.hide();
      });
      document.body.appendChild(this.overlayEl);
    }

    const groups = this.getGroups();
    let groupsHTML = "";

    groups.forEach((hotkeys, groupName) => {
      const rows = hotkeys
        .map(
          (h) =>
            `<div class="hh-row">
              <span class="hh-desc">${h.description}</span>
              <span class="hh-keys">${this.renderKeyBadges(h.keys)}</span>
            </div>`
        )
        .join("");
      groupsHTML += `<div class="hh-group">
        <div class="hh-group-title">${groupName}</div>
        ${rows}
      </div>`;
    });

    this.overlayEl.innerHTML = `
      <div class="hh-modal">
        <div class="hh-header">
          <span class="hh-title">${this.options.title}</span>
          <button class="hh-close" aria-label="Close shortcuts">✕</button>
        </div>
        <div class="hh-body">${groupsHTML}</div>
        <div class="hh-footer">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</div>
      </div>`;

    this.overlayEl.querySelector(".hh-close")?.addEventListener("click", () => this.hide());
    this.overlayEl.style.display = "flex";
    requestAnimationFrame(() => {
      this.overlayEl?.classList.add("hh-visible");
    });
  }

  private renderKeyBadges(keys: string): string {
    if (keys.includes(" then ")) {
      return keys
        .split(" then ")
        .map((k) => `<kbd class="hh-key">${this.formatKeys(k.trim())}</kbd>`)
        .join(`<span class="hh-then">then</span>`);
    }
    return `<kbd class="hh-key">${this.formatKeys(keys)}</kbd>`;
  }

  private injectStyles(): void {
    if (document.getElementById("hotkey-hint-styles")) return;
    this.styleEl = document.createElement("style");
    this.styleEl.id = "hotkey-hint-styles";
    this.styleEl.textContent = getStyles();
    document.head.appendChild(this.styleEl);
  }
}

function getStyles(): string {
  return `
    .hh-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0);
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: background 0.2s ease;
    }
    .hh-overlay.hh-visible {
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
    }
    .hh-modal {
      background: var(--hh-bg, #ffffff);
      color: var(--hh-text, #111111);
      border-radius: 12px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06);
      width: 520px;
      max-width: calc(100vw - 32px);
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      opacity: 0;
      transform: scale(0.94) translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .hh-visible .hh-modal {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    .hh-dark .hh-modal {
      --hh-bg: #1a1a1a;
      --hh-text: #f0f0f0;
      --hh-border: rgba(255,255,255,0.08);
      --hh-group-title: rgba(255,255,255,0.4);
      --hh-key-bg: #2a2a2a;
      --hh-key-border: rgba(255,255,255,0.12);
      --hh-key-text: #e0e0e0;
      --hh-row-hover: rgba(255,255,255,0.04);
      --hh-footer: rgba(255,255,255,0.3);
    }
    .hh-light .hh-modal, .hh-modal {
      --hh-bg: #ffffff;
      --hh-text: #111111;
      --hh-border: rgba(0,0,0,0.08);
      --hh-group-title: rgba(0,0,0,0.4);
      --hh-key-bg: #f4f4f5;
      --hh-key-border: rgba(0,0,0,0.1);
      --hh-key-text: #333333;
      --hh-row-hover: rgba(0,0,0,0.03);
      --hh-footer: rgba(0,0,0,0.3);
    }
    @media (prefers-color-scheme: dark) {
      .hh-auto .hh-modal {
        --hh-bg: #1a1a1a;
        --hh-text: #f0f0f0;
        --hh-border: rgba(255,255,255,0.08);
        --hh-group-title: rgba(255,255,255,0.4);
        --hh-key-bg: #2a2a2a;
        --hh-key-border: rgba(255,255,255,0.12);
        --hh-key-text: #e0e0e0;
        --hh-row-hover: rgba(255,255,255,0.04);
        --hh-footer: rgba(255,255,255,0.3);
      }
    }
    .hh-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--hh-border);
    }
    .hh-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .hh-close {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--hh-group-title);
      font-size: 14px;
      padding: 4px 8px;
      border-radius: 6px;
      line-height: 1;
      transition: background 0.15s, color 0.15s;
    }
    .hh-close:hover {
      background: var(--hh-row-hover);
      color: var(--hh-text);
    }
    .hh-body {
      padding: 12px 0;
      overflow-y: auto;
      flex: 1;
    }
    .hh-group { margin-bottom: 4px; }
    .hh-group-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--hh-group-title);
      padding: 8px 20px 4px;
    }
    .hh-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 20px;
      gap: 16px;
      transition: background 0.12s;
    }
    .hh-row:hover { background: var(--hh-row-hover); }
    .hh-desc {
      font-size: 13.5px;
      color: var(--hh-text);
      flex: 1;
    }
    .hh-keys {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .hh-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--hh-key-bg);
      border: 1px solid var(--hh-key-border);
      border-bottom-width: 2px;
      border-radius: 5px;
      padding: 2px 7px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      color: var(--hh-key-text);
      min-width: 24px;
      line-height: 1.6;
    }
    .hh-then {
      font-size: 11px;
      color: var(--hh-group-title);
      margin: 0 2px;
    }
    .hh-footer {
      padding: 10px 20px;
      border-top: 1px solid var(--hh-border);
      font-size: 12px;
      color: var(--hh-footer);
      text-align: center;
    }
    .hh-footer kbd {
      font-family: inherit;
      background: var(--hh-key-bg);
      border: 1px solid var(--hh-key-border);
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 11px;
    }
  `;
}

export default HotkeyHint;
