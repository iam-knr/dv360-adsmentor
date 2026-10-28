/** Read a text field from a submitted form; files and missing fields come back as ''. */
export function formString(data: FormData, key: string): string {
  const v = data.get(key);
  return typeof v === 'string' ? v : '';
}
