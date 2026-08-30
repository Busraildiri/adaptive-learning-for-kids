import { calculateAgeInMonths } from "@adaptive/shared-types";

export function formatChildAge(birthMonth: number, birthYear: number, today = new Date()): string {
  const totalMonths = Math.max(0, calculateAgeInMonths(birthMonth, birthYear, today));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${years} yıl ${months} ay`;
}
