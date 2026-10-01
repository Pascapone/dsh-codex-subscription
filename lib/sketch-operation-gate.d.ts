export declare function createSketchOperationGate(): {
    readonly running: boolean;
    run(operation: () => unknown | Promise<unknown>, { blocked, working, report, rethrow }: {
        blocked?: boolean;
        working(value: boolean): void;
        report(error: unknown): void;
        rethrow?: boolean;
    }): Promise<boolean>;
};
