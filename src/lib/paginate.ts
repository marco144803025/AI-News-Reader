export type Page<T> = { pageItems: T[]; totalPages: number };

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): Page<T> {
  const totalPages = Math.ceil(items.length / pageSize);
  const start = page * pageSize;
  return { pageItems: items.slice(start, start + pageSize), totalPages };
}
