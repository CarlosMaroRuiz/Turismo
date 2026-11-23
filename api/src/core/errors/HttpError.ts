export interface HttpErrorOptions {
  /** Código estable y legible por máquina (el frontend y el LLM ramifican por aquí). */
  code?: string;
  errors?: Record<string, string[]>;
}

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors: Record<string, string[]> | undefined;

  constructor(
    statusCode: number,
    message: string,
    options: HttpErrorOptions = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = options.code ?? "ERROR";
    this.errors = options.errors;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
