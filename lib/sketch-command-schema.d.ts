export declare const sketchCommandArray: {
    readonly type: "array";
    readonly items: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly properties: {
            readonly action: {
                readonly type: "string";
                readonly enum: readonly ["update", "duplicate", "delete", "add", "select", "rename", "visible", "up", "down", "clear"];
            };
            readonly value: {
                readonly type: "string";
            };
            readonly ratio: {
                readonly type: "string";
                readonly enum: readonly ["1:1", "4:3", "3:4", "16:9", "9:16"];
            };
            readonly patch: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly color: {
                        readonly type: "string";
                    };
                    readonly width: {
                        readonly type: "number";
                    };
                    readonly opacity: {
                        readonly type: "number";
                    };
                    readonly fill: {
                        readonly type: "boolean";
                    };
                    readonly text: {
                        readonly type: "string";
                    };
                    readonly points: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly x: {
                                    readonly required: true;
                                    readonly type: "number";
                                };
                                readonly y: {
                                    readonly required: true;
                                    readonly type: "number";
                                };
                            };
                        };
                    };
                };
            };
            readonly transform: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly dx: {
                        readonly type: "number";
                    };
                    readonly dy: {
                        readonly type: "number";
                    };
                    readonly scaleX: {
                        readonly type: "number";
                    };
                    readonly scaleY: {
                        readonly type: "number";
                    };
                };
            };
            readonly color: {
                readonly type: "string";
            };
            readonly width: {
                readonly type: "number";
            };
            readonly opacity: {
                readonly type: "number";
            };
            readonly fill: {
                readonly type: "boolean";
            };
            readonly text: {
                readonly type: "string";
            };
            readonly points: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly properties: {
                        readonly x: {
                            readonly required: true;
                            readonly type: "number";
                        };
                        readonly y: {
                            readonly required: true;
                            readonly type: "number";
                        };
                    };
                };
            };
            readonly op: {
                readonly type: "string";
                readonly required: true;
                readonly enum: readonly ["stroke", "object", "layer", "resize"];
            };
            readonly id: {
                readonly oneOf: readonly [{
                    readonly type: "string";
                }, {
                    readonly type: "integer";
                }];
                readonly description: "Object string ID. Layer add: optional NEW unique integer ID; other layer actions: existing layer ID.";
            };
            readonly after: {
                readonly type: "integer";
                readonly description: "Layer add only: existing layer to insert after; defaults to active.";
            };
            readonly start: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly x: {
                        readonly required: true;
                        readonly type: "number";
                    };
                    readonly y: {
                        readonly required: true;
                        readonly type: "number";
                    };
                };
            };
            readonly segments: {
                readonly type: "array";
                readonly items: {
                    readonly type: "object";
                    readonly additionalProperties: false;
                    readonly properties: {
                        readonly control1: {
                            readonly required: true;
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly x: {
                                    readonly required: true;
                                    readonly type: "number";
                                };
                                readonly y: {
                                    readonly required: true;
                                    readonly type: "number";
                                };
                            };
                        };
                        readonly control2: {
                            readonly required: true;
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly x: {
                                    readonly required: true;
                                    readonly type: "number";
                                };
                                readonly y: {
                                    readonly required: true;
                                    readonly type: "number";
                                };
                            };
                        };
                        readonly end: {
                            readonly required: true;
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly x: {
                                    readonly required: true;
                                    readonly type: "number";
                                };
                                readonly y: {
                                    readonly required: true;
                                    readonly type: "number";
                                };
                            };
                        };
                    };
                };
            };
            readonly layer: {
                readonly type: "integer";
            };
            readonly shape: {
                readonly type: "string";
                readonly enum: readonly ["pen", "line", "arrow", "text", "rectangle", "circle", "ellipse", "polygon", "bezier", "eraser", "triangle", "diamond", "star"];
            };
        };
    };
};
