export declare function switchSketchToolWidth(memory: Record<string, number | undefined>, current: {
    tool: string;
    brush?: string;
    width: number;
}, next: {
    tool: string;
    brush?: string;
}): number;
export declare function stepSketchWidth(width: number, direction: number): number;
