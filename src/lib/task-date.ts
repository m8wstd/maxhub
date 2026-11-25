const TIME_ZONE = "America/Sao_Paulo";

export function todayInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dateFromOffset(date: string, offset: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + offset));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function daysBetween(from: string, to: string) {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function weekdayForDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function bucketForDate(date: string | null, today: string) {
  if (!date) return "today";
  const distance = daysBetween(today, date);
  if (distance < 0) return "overdue";
  if (distance === 0) return "today";
  if (distance === 1) return "tomorrow";
  if (distance <= 6 - weekdayForDate(today)) return `date:${date}`;
  return "later";
}

export function remainingWeekdays(today: string) {
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const count = 6 - weekdayForDate(today);
  return Array.from({ length: count }, (_, index) => {
    const date = dateFromOffset(today, index + 1);
    return { id: `date:${date}`, label: capitalize(days[weekdayForDate(date)]), date };
  });
}

export function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}
