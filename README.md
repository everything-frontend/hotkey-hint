# ⌨️ hotkey-hint

> Keyboard shortcut manager with a beautiful overlay. Register hotkeys, reveal them with `?`, handle sequences and groups — in 5 lines. Zero dependencies.

[![npm version](https://img.shields.io/npm/v/hotkey-hint)](https://www.npmjs.com/package/hotkey-hint)
[![npm downloads](https://img.shields.io/npm/dm/hotkey-hint)](https://www.npmjs.com/package/hotkey-hint)
[![bundle size](https://img.shields.io/bundlephobia/minzip/hotkey-hint)](https://bundlephobia.com/package/hotkey-hint)
[![license](https://img.shields.io/github/license/everything-frontend/hotkey-hint)](https://github.com/everything-frontend/hotkey-hint/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/types-included-blue)](https://www.npmjs.com/package/hotkey-hint)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-green)](https://www.npmjs.com/package/hotkey-hint)

---

## Why

Every power-user app — GitHub, Figma, Linear, Notion — has a keyboard shortcut layer that reveals itself when you press `?`. Building one from scratch means wiring up event listeners, handling modifier keys, managing sequences like `g then h`, grouping shortcuts by category, and building a UI on top of all that.

**hotkey-hint does all of that for you.**

---

## Install

```bash
npm install hotkey-hint
# or
yarn add hotkey-hint
# or
pnpm add hotkey-hint
```

---

## Quick Start

```ts
import HotkeyHint from 'hotkey-hint';

const hh = new HotkeyHint({ theme: 'auto' });

hh.registerAll([
  {
    keys: 'ctrl+k',
    description: 'Open command palette',
    action: () => openCommandPalette(),
  },
  {
    keys: 'ctrl+s',
    description: 'Save document',
    action: () => save(),
  },
]);

// That's it. Press ? to open the overlay.
```

---

## Features

- **Zero dependencies** — pure TypeScript, no external packages
- **Beautiful overlay** — press `?` to show all registered shortcuts, grouped and labeled
- **Sequence shortcuts** — vim-style `g then h` sequences with a 2s timeout
- **Groups** — organize shortcuts by category (Navigation, Editor, etc.)
- **Themes** — `dark`, `light`, or `auto` (follows `prefers-color-scheme`)
- **Smart modifier detection** — handles `ctrl`, `shift`, `alt`, `meta`/`cmd` cross-platform
- **Skips inputs** — never fires inside `<input>`, `<textarea>`, or `contenteditable`
- **Chainable API** — `.register().register().registerAll()`
- **SSR safe** — guards all DOM access behind `typeof window`
- **~3kB minified + gzipped**

---

## API

### `new HotkeyHint(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `triggerKey` | `string` | `"?"` | Key that opens the overlay |
| `theme` | `"dark" \| "light" \| "auto"` | `"auto"` | Color theme |
| `position` | `"center" \| "bottom-right" \| "bottom-left"` | `"center"` | Panel position |
| `title` | `string` | `"Keyboard Shortcuts"` | Overlay heading |
| `zIndex` | `number` | `9999` | CSS z-index |

### Instance methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.register(hotkey)` | `this` | Register a single hotkey |
| `.registerAll(hotkeys[])` | `this` | Register multiple hotkeys |
| `.unregister(keys)` | `this` | Remove a hotkey by key string |
| `.show()` | `void` | Open the overlay programmatically |
| `.hide()` | `void` | Close the overlay |
| `.toggle()` | `void` | Show/hide |
| `.destroy()` | `void` | Remove all listeners and DOM elements |

### `HotkeyDefinition`

```ts
interface HotkeyDefinition {
  keys: string;           // "ctrl+k", "shift+?", "g then h"
  description: string;    // shown in the overlay
  action: () => void;     // called when shortcut fires
  group?: string;         // groups shortcuts in the overlay (default: "General")
  preventDefault?: boolean; // default: true
}
```

---

## Examples

### With groups

```ts
hh.registerAll([
  { keys: 'g then h', description: 'Go home',       group: 'Navigation', action: goHome },
  { keys: 'g then p', description: 'Go to profile', group: 'Navigation', action: goProfile },

  { keys: 'ctrl+b',   description: 'Bold',      group: 'Editor', action: bold },
  { keys: 'ctrl+i',   description: 'Italic',    group: 'Editor', action: italic },
]);
```

### Sequence shortcuts (vim-style)

```ts
hh.register({
  keys: 'g then s',
  description: 'Go to settings',
  group: 'Navigation',
  action: () => router.push('/settings'),
});
```

### React hook

```ts
import { useEffect } from 'react';
import HotkeyHint from 'hotkey-hint';

function useHotkeys(hotkeys: HotkeyDefinition[], deps: any[] = []) {
  useEffect(() => {
    const hh = new HotkeyHint({ theme: 'auto' });
    hh.registerAll(hotkeys);
    return () => hh.destroy();
  }, deps);
}
```

### Programmatic control

```ts
// Show/hide from anywhere
document.getElementById('help-btn').addEventListener('click', () => hh.show());

// Dynamically add/remove
hh.register({ keys: 'ctrl+p', description: 'Print', action: print });
hh.unregister('ctrl+p');
```

### CDN (no build step)

```html
<script type="module">
  import HotkeyHint from 'https://esm.sh/hotkey-hint';
  const hh = new HotkeyHint();
  hh.register({ keys: 'ctrl+k', description: 'Search', action: openSearch });
</script>
```

---

## Supported Key Syntax

| Input | Rendered (Mac) | Rendered (Win/Linux) |
|-------|---------------|----------------------|
| `ctrl+k` | `⌃K` | `Ctrl+K` |
| `cmd+shift+p` | `⌘⇧P` | `Ctrl+⇧P` |
| `alt+t` | `⌥T` | `Alt+T` |
| `g then h` | `G` then `H` | `G` then `H` |
| `escape` | `Esc` | `Esc` |
| `shift+?` | `⇧?` | `⇧?` |

---

## Customization

Override CSS variables to theme the overlay:

```css
.hh-modal {
  --hh-bg: #0f172a;
  --hh-text: #f8fafc;
  --hh-border: rgba(255,255,255,0.06);
  --hh-key-bg: #1e293b;
  --hh-key-border: rgba(255,255,255,0.1);
  --hh-key-text: #e2e8f0;
  --hh-group-title: rgba(255,255,255,0.35);
  --hh-row-hover: rgba(255,255,255,0.03);
  --hh-footer: rgba(255,255,255,0.25);
}
```

---

## License

[MIT](https://github.com/everything-frontend/hotkey-hint/blob/main/LICENSE)
