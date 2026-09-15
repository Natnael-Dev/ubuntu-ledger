// Application Service Error Definitions
// Authoritative source: docs/specs/03-data-model.md §11, docs/specs/04-state-machine.md §8

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
