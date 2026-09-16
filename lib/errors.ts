export class AppError extends Error {
  constructor(
    public message: string,
    public status = 400,
    public code = "APPLICATION_ERROR",
  ) {
    super(message);
  }
}
export const unavailable = "Dado não disponibilizado pela API.";
export function safeError(e: unknown) {
  return e instanceof AppError
    ? e.message
    : "Não foi possível concluir a operação. Verifique as configurações e tente novamente.";
}
