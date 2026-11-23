export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  ok: false;
  /** Código estable y legible por máquina, por ejemplo "VALIDATION_ERROR". */
  code: string;
  message: string;
  errors?: Record<string, string[]>;
}
