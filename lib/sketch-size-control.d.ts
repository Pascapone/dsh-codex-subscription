export declare function SketchSizeControl({ value, onChange, onStart, onEnd, label, disabled, min, max, mode, modes, onModeChange, suffix }: {
    value: number;
    onChange(value: number): void;
    onStart?(): void;
    onEnd?(): void;
    label: string;
    disabled?: boolean;
    min?: number;
    max?: number;
    mode?: string;
    modes?: {
        value: string;
        label: string;
    }[];
    onModeChange?(value: string): void;
    suffix?: string;
}): import("react/jsx-runtime").JSX.Element;
