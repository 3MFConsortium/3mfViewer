export function normalizeName(resource, fallback) {
  if (typeof resource?.GetName === "function") {
    const name = resource.GetName();
    if (name) return name;
  }
  return fallback;
}

