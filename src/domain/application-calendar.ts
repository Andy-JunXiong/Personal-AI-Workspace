export interface CalendarApplication {
  projectId: string;
  company: string;
  role: string;
  appliedDate: string | null;
}

/** Submission history is independent of current lifecycle and list pagination. */
export function applicationCalendar(applications: CalendarApplication[], now: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const valid = applications.filter(a => typeof a.appliedDate === "string"
    && /^\d{4}-\d{2}-\d{2}$/u.test(a.appliedDate)
    && Number.isFinite(Date.parse(a.appliedDate))
    && new Date(a.appliedDate).toISOString().slice(0, 10) === a.appliedDate);
  const months = [-1, 0].map(offset => {
    const start = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1 + offset, 1));
    const year = start.getUTCFullYear(), month = start.getUTCMonth() + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const days = Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, i) => {
      const date = `${prefix}-${String(i + 1).padStart(2, "0")}`;
      return { date, day: i + 1, applications: valid.filter(a => a.appliedDate === date) };
    });
    return { year, month, offset, leading: (start.getUTCDay() + 6) % 7, days,
      total: days.reduce((n, d) => n + d.applications.length, 0),
      activeDays: days.filter(d => d.applications.length).length };
  });
  return { today, months, undatedCount: applications.length - valid.length };
}
