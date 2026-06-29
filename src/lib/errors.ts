export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code = 'INTERNAL',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class NotImplementedError extends AppError {
  constructor(what: string) {
    super(`${what} not implemented`, 501, 'NOT_IMPLEMENTED');
  }
}
