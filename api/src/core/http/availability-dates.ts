export function shiftDate(date: string, days: number): string {
  const utc = new Date(`${date}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function availabilityDates(date: string, flexDays: number): string[] {
  const dates = [date];
  for (let distance = 1; distance <= flexDays; distance++) {
    dates.push(shiftDate(date, -distance), shiftDate(date, distance));
  }
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" });
  return dates.filter((candidate) => candidate >= today);
}
