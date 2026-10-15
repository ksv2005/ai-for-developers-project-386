/** Поле, на которое указывает сообщение 400 сервера («body/guestEmail must …»). */
export function fieldOf<F extends string>(
  message: string,
  fields: readonly F[],
): F | null {
  return (
    fields.find((field) =>
      new RegExp(`(?<![A-Za-z])${field}(?![A-Za-z])`).test(message),
    ) ?? null
  );
}
