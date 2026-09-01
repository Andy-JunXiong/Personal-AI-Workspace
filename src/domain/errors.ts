export class WorkspaceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends WorkspaceError {
  constructor(message: string) {
    super("NOT_FOUND", message);
  }
}

export class ValidationError extends WorkspaceError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
  }
}

export class AuthorizationError extends WorkspaceError {
  constructor(message: string) {
    super("AUTHORIZATION_ERROR", message);
  }
}

export class IdempotencyConflictError extends WorkspaceError {
  constructor(message: string) {
    super("IDEMPOTENCY_CONFLICT", message);
  }
}

export class ConcurrencyConflictError extends WorkspaceError {
  constructor(message: string) {
    super("CONCURRENCY_CONFLICT", message);
  }
}
