/** Minor status, as §10.1 of the specification defines it. */

export const AGE_OF_MAJORITY = 18;

const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function parseDate(value: string): CalendarDate | undefined {
  const match = DATE.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return undefined;
  }
  return { year, month, day };
}

/** The calendar date part of an RFC 3339 timestamp, as written, in its own time zone offset. */
export function datePartOf(timestamp: string): string | undefined {
  const datePart = timestamp.slice(0, 10);
  return parseDate(datePart) ? datePart : undefined;
}

/**
 * Returns true if a person born on `dateOfBirth` is less than 18 years old on `referenceDate`.
 * Both values are `YYYY-MM-DD`. Returns undefined if a date is not valid.
 *
 * A person born on 29 February becomes 18 on 1 March in a year that is not a leap year.
 * This is the safer choice for safeguarding, because the person stays a minor for one more day.
 */
export function isMinorOn(dateOfBirth: string, referenceDate: string): boolean | undefined {
  const birth = parseDate(dateOfBirth);
  const reference = parseDate(referenceDate);
  if (!birth || !reference) return undefined;

  const adultYear = birth.year + AGE_OF_MAJORITY;
  let adultMonth = birth.month;
  let adultDay = birth.day;
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(adultYear)) {
    adultMonth = 3;
    adultDay = 1;
  }

  const referenceKey = reference.year * 10_000 + reference.month * 100 + reference.day;
  const adultKey = adultYear * 10_000 + adultMonth * 100 + adultDay;
  return referenceKey < adultKey;
}

/**
 * Returns the age in whole years of a person born on `dateOfBirth`, on `referenceDate`.
 * Both values are `YYYY-MM-DD`. Returns undefined if a date is not valid, or if the reference date is before the birth.
 *
 * The age increases at the start of the birthday. A person born on 29 February has their birthday on 1 March
 * in a year that is not a leap year. This agrees with `isMinorOn`: the result is less than 18 exactly when that
 * function returns true.
 */
export function ageOn(dateOfBirth: string, referenceDate: string): number | undefined {
  const birth = parseDate(dateOfBirth);
  const reference = parseDate(referenceDate);
  if (!birth || !reference) return undefined;

  let birthdayMonth = birth.month;
  let birthdayDay = birth.day;
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(reference.year)) {
    birthdayMonth = 3;
    birthdayDay = 1;
  }

  const beforeBirthday = reference.month * 100 + reference.day < birthdayMonth * 100 + birthdayDay;
  const age = reference.year - birth.year - (beforeBirthday ? 1 : 0);
  return age < 0 ? undefined : age;
}

/** Calculates `consent.is_minor` for a document from its date of birth and `submitted_at`. */
export function calculateIsMinor(dateOfBirth: unknown, submittedAt: unknown): boolean | undefined {
  if (typeof dateOfBirth !== "string" || typeof submittedAt !== "string") return undefined;
  const referenceDate = datePartOf(submittedAt);
  if (!referenceDate) return undefined;
  return isMinorOn(dateOfBirth, referenceDate);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Calculates the age of the player on the date of `submitted_at`, in the time zone offset of the timestamp (§10.1). */
export function calculateAge(dateOfBirth: unknown, submittedAt: unknown): number | undefined {
  if (typeof dateOfBirth !== "string" || typeof submittedAt !== "string") return undefined;
  const referenceDate = datePartOf(submittedAt);
  if (!referenceDate) return undefined;
  return ageOn(dateOfBirth, referenceDate);
}
