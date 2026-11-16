export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const notFound = () => new ApiError(404, "NOT_FOUND", "Nie znaleziono zasobu");
export const forbidden = () => new ApiError(403, "FORBIDDEN", "Brak uprawnień");
export const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "Wymagane zalogowanie");
