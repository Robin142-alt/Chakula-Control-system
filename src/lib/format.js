export function formatKes(value) {
  return `KES ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatMealLabel(mealType) {
  return String(mealType || "")
    .toLowerCase()
    .replace(/^\w/, (character) => character.toUpperCase());
}

export function toDateTimeInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeInputValue(value) {
  if (!value) {
    return new Date().toISOString();
  }

  return new Date(value).toISOString();
}

