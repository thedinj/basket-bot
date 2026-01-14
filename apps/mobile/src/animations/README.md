# Overlay Animation System

## Overview

A reusable, CSS-first overlay animation system for full-screen effects in Basket Bot. Animations are defined in a central library and can be triggered programmatically with optional sound effects and haptic feedback.

## Architecture

### Components

1. **Effects Library** (`src/animations/effects.ts`)

    - Central registry of all available animations
    - Each effect defines: CSS class, duration, sound path, haptic settings

2. **Hook** (`src/hooks/useOverlayAnimation.ts`)

    - Triggers animation, plays sound, provides haptic feedback
    - Returns `{ trigger, isActive, cssClass }` for component integration
    - Prevents simultaneous animations module-wide

3. **Component** (`src/components/shared/OverlayAnimation.tsx`)

    - Generic fixed-position overlay that covers viewport
    - Applies CSS class from hook
    - Removes itself when no class is active

4. **CSS** (`src/components/shared/OverlayAnimation.css`)
    - Base overlay styling (fixed, z-index 10000, pointer-events: none)
    - Animation-specific keyframes and styles

## Usage

### Adding a New Animation

1. **Define the effect** in `src/animations/effects.ts`:

```typescript
export const ANIMATION_EFFECTS = {
    // ... existing effects

    YOUR_ANIMATION: {
        cssClass: "your-animation",
        soundPath: "/sounds/your-sound.mp3", // optional
        duration: 800, // milliseconds
        haptic: true, // optional
    } as AnimationEffect,
} as const;
```

2. **Add CSS animation** in `src/components/shared/OverlayAnimation.css`:

```css
.overlay-animation.your-animation::before {
    content: "";
    position: absolute;
    /* Your animation styles */
    animation: yourKeyframe 0.8s ease-in-out forwards;
}

@keyframes yourKeyframe {
    0% {
        /* start state */
    }
    100% {
        /* end state */
    }
}
```

3. **Use in component**:

```typescript
import { ANIMATION_EFFECTS } from "@/animations/effects";
import { useOverlayAnimation } from "@/hooks/useOverlayAnimation";
import { OverlayAnimation } from "@/components/shared/OverlayAnimation";

const MyComponent: React.FC = () => {
    const { trigger, isActive, cssClass } = useOverlayAnimation(
        ANIMATION_EFFECTS.YOUR_ANIMATION
    );

    const handleAction = async () => {
        await trigger(); // Plays animation + sound + haptics
        // Wait for animation to complete
        setTimeout(() => {
            // Perform action after animation
        }, ANIMATION_EFFECTS.YOUR_ANIMATION.duration);
    };

    return (
        <>
            <IonButton onClick={handleAction}>Trigger</IonButton>
            <OverlayAnimation cssClass={cssClass} />
        </>
    );
};
```

## Sound Files

Place sound effect files in `public/sounds/` directory:

```
public/
  sounds/
    laser-zap.mp3
    explosion.mp3
    swipe.mp3
```

Reference them in the effects library with `/sounds/filename.mp3` paths.

## Available Effects

### LASER_OBLITERATION

-   **Purpose**: Visual "deletion" effect for clearing shopping list items
-   **Duration**: 1000ms (1 second)
-   **Sound**: `/sounds/laser-zap.mp3` (user-provided)
-   **Visual**: Purple laser beam with white core sweeps from top to bottom
-   **Colors**: Uses `--ion-color-primary` CSS variable for purple

## Technical Details

### Preventing Simultaneous Animations

The hook uses a module-level flag (`isAnyAnimationActive`) to ensure only one animation plays at a time. If `trigger()` is called while another animation is active, it logs a warning and exits early.

### Sound Playback Error Handling

If sound playback fails (e.g., autoplay policies, missing file), the system:

1. Logs a warning to console
2. Falls back to haptic feedback if `haptic: true`
3. Continues with visual animation

### Cleanup

The hook automatically:

-   Clears timeouts on unmount
-   Stops audio playback on unmount
-   Resets global animation flag when component unmounts mid-animation

## Styling Guidelines

### CSS Best Practices

-   Use `::before` or `::after` pseudo-elements for animation content
-   Always set `pointer-events: none` on overlay elements
-   Use `position: fixed` for full-viewport coverage
-   Keep z-index at 10000 or higher to overlay all content
-   Use CSS variables for colors (e.g., `--ion-color-primary`)

### Animation Performance

-   Use `transform` and `opacity` for smooth 60fps animations
-   Avoid animating `width`, `height`, `top`, `left` directly
-   Use `will-change` sparingly (only if needed for performance)
-   Keep duration under 2 seconds for good UX

## Example: Laser Obliteration in ShoppingList

```typescript
// Trigger animation before clearing items
const confirmClearChecked = useCallback(async () => {
    setShowClearCheckedAlert(false);
    await triggerLaser(); // Start animation

    // Wait for animation to complete
    setTimeout(() => {
        if (selectedStoreId) {
            clearChecked.mutate({ storeId: selectedStoreId });
        }
    }, ANIMATION_EFFECTS.LASER_OBLITERATION.duration);
}, [clearChecked, selectedStoreId, triggerLaser]);

// Fade out checked items during animation
<CheckedItems
    items={checkedItems}
    onClearChecked={handleClearChecked}
    isFadingOut={isObliterating}
/>

// Render overlay
<OverlayAnimation cssClass={cssClass} />
```

## Future Enhancements

-   Add custom duration parameter to `useOverlayAnimation` hook
-   Support multiple simultaneous animations (with priority system)
-   Add animation completion callbacks
-   Create more preset animations (explosion, swipe, fade, etc.)
