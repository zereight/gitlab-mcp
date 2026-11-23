/**
 * Error for a tool call whose arguments are invalid or cannot be resolved. index.ts maps
 * it to a client-side error result with `instanceof`, so every tool module must throw
 * this one class rather than its own.
 */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}
