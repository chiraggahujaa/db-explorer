# Dark Mode Implementation Guide

## Overview

This project uses a modern, generalized dark mode implementation that follows 2025 best practices for Next.js 15 App Router with Tailwind CSS 4.

## Architecture

### Core Components

1. **ThemeProvider** (`src/providers/ThemeProvider.tsx`)
   - Wraps the application with `next-themes` library
   - Provides theme management context
   - Handles browser storage persistence automatically
   - Supports: Light, Dark, and System preferences

2. **ThemeToggle** (`src/components/theme/ThemeToggle.tsx`)
   - Dropdown menu component for theme selection
   - Animated sun/moon icons
   - Located in the header for easy access

3. **CSS Variables** (`src/app/globals.css`)
   - Line 4: `@custom-variant dark (&:is(.dark *))`
   - Lines 46-79: Light mode color definitions (`:root`)
   - Lines 81-113: Dark mode color definitions (`.dark`)
   - Uses OKLch color format for perceptual uniformity

### Key Features

✅ **Automatic Browser Storage** - Theme preference persists via localStorage
✅ **System Preference Detection** - Respects OS dark mode setting
✅ **No Flash of Wrong Theme** - Uses `suppressHydrationWarning`
✅ **Tab Synchronization** - Theme changes sync across browser tabs
✅ **Semantic Color Tokens** - No hardcoded colors, all use CSS variables
✅ **Component Ready** - All 36+ shadcn/ui components support dark mode

## How to Use Dark Mode in Development

### Using Dark Mode Classes

All Tailwind utilities support the `dark:` variant:

```tsx
// Background colors
<div className="bg-background dark:bg-background" />

// Text colors
<p className="text-foreground dark:text-foreground" />

// Border colors
<div className="border-border dark:border-border" />
```

### Using Semantic Color Tokens

Instead of hardcoding colors, always use semantic tokens:

```tsx
// ✅ Good - Uses semantic tokens
<Button className="bg-primary text-primary-foreground" />

// ❌ Bad - Hardcoded colors
<Button className="bg-blue-500 text-white" />
```

### Available Color Tokens

- `background` / `foreground` - Page background and text
- `card` / `card-foreground` - Card backgrounds
- `primary` / `primary-foreground` - Primary actions
- `secondary` / `secondary-foreground` - Secondary actions
- `muted` / `muted-foreground` - Muted/disabled states
- `accent` / `accent-foreground` - Accent highlights
- `destructive` - Destructive actions (delete, etc.)
- `border` - Border colors
- `input` - Input field borders
- `ring` - Focus ring colors

### Accessing Theme in Components

```tsx
"use client";

import { useTheme } from "next-themes";

export function MyComponent() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={() => setTheme("dark")}>Dark</button>
      <button onClick={() => setTheme("light")}>Light</button>
      <button onClick={() => setTheme("system")}>System</button>
    </div>
  );
}
```

## Adding New Components

When creating new components, follow this pattern:

1. **Use semantic color tokens** from `globals.css`
2. **Add dark: variants** where needed
3. **Test in both themes** to ensure contrast and readability

Example:

```tsx
export function NewComponent() {
  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-4">
      <h2 className="text-foreground font-semibold">Title</h2>
      <p className="text-muted-foreground">Description</p>
      <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
        Action
      </Button>
    </div>
  );
}
```

## Color System Design

### Light Mode (Default)
- Background: Pure white (`oklch(1 0 0)`)
- Foreground: Very dark gray (`oklch(0.15 0.015 270)`)
- Primary: Vibrant blue (`oklch(0.55 0.22 264)`)
- Card: Off-white (`oklch(0.99 0 0)`)
- Border: Light gray (`oklch(0.90 0.01 270)`)
- Border Radius: 0.75rem (modern, slightly rounded)

### Dark Mode (Modern & Professional)
- Background: Very dark neutral (`oklch(0.12 0.01 270)`) - Almost black, easier on eyes
- Foreground: Light gray (`oklch(0.92 0.01 270)`) - High contrast but not pure white
- Primary: Vibrant blue/purple (`oklch(0.60 0.20 264)`) - Stands out in dark mode
- Card: Elevated dark surface (`oklch(0.17 0.012 270)`) - Clear depth hierarchy
- Popover: Slightly lighter (`oklch(0.19 0.012 270)`) - Better dropdown visibility
- Secondary: Medium dark (`oklch(0.22 0.015 270)`)
- Border: Subtle but visible (`oklch(0.28 0.02 270)`)
- Muted Text: Mid-range gray (`oklch(0.60 0.015 270)`)

**Design Philosophy:**
- Inspired by GitHub Dark, VS Code Dark+, and Discord
- Uses very dark neutral tones instead of pure black (easier on eyes for long sessions)
- Clear visual hierarchy through surface elevation
- Vibrant accent colors that pop in dark mode
- Subtle but visible borders for better component definition
- Modern border radius for contemporary look

## Browser Storage

Theme preferences are automatically saved to `localStorage` under the key:
```
theme: "light" | "dark" | "system"
```

No additional configuration needed - this is handled by `next-themes`.

## Best Practices Going Forward

1. **Always use semantic tokens** - Never hardcode colors
2. **Test both themes** - Check every new component in light and dark mode
3. **Use OKLch format** - When adding new colors, use OKLch for consistency
4. **Maintain contrast** - Ensure sufficient contrast ratios (WCAG AA minimum)
5. **Avoid forced themes** - Respect user's preference unless absolutely necessary

## Technical Details

- **Library**: `next-themes@0.4.6`
- **Strategy**: Class-based (`.dark` class on `<html>`)
- **Color Format**: OKLch (perceptually uniform)
- **Storage**: localStorage
- **SSR**: Handled with `suppressHydrationWarning`
- **Tailwind**: v4 with `@custom-variant`

## Troubleshooting

### Flash of wrong theme on load
- Ensure `suppressHydrationWarning` is on the `<html>` tag
- Check that `ThemeProvider` wraps all content

### Theme not persisting
- Check browser's localStorage isn't disabled
- Verify `next-themes` is properly installed
- Check for `disableTransitionOnChange` if animations are glitchy

### Colors not changing in dark mode
- Ensure you're using semantic tokens, not hardcoded colors
- Check that `dark:` variants are applied correctly
- Verify globals.css has both `:root` and `.dark` definitions

## References

- [next-themes documentation](https://github.com/pacocoursey/next-themes)
- [Tailwind CSS 4 dark mode](https://tailwindcss.com/docs/dark-mode)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
