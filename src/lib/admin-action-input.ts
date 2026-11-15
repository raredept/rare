export function parseAdminEntityId(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 && id.length <= 128 ? id : null;
}
