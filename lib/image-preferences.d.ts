import type { CodexUiProps } from './client-types.js';
import type { ComponentProps } from 'react';
import { Menu } from './client-primitives.js';
export declare function ImageChoice({ label, hint, value, text, items, disabled, onSelect }: {
    label: string;
    hint?: string;
    value: string;
    text: string;
    items: ComponentProps<typeof Menu>['items'];
    disabled: boolean;
    onSelect(id: string): void;
}): import("react/jsx-runtime").JSX.Element;
export declare function ImagePreferences({ preference, t }: Pick<CodexUiProps, 'preference' | 't'>): import("react/jsx-runtime").JSX.Element;
