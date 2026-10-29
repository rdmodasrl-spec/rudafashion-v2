export type MerchantAssistantDateRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
};

const dayMs = 24 * 60 * 60 * 1000;

function makeRange(start: Date, end: Date, label: string): MerchantAssistantDateRange {
  const duration = end.getTime() - start.getTime();
  return {
    start,
    end,
    previousStart: new Date(start.getTime() - duration),
    previousEnd: start,
    label
  };
}

function parseDay(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function getMerchantAssistantDateRange(
  question: string,
  now = new Date()
): MerchantAssistantDateRange {
  const explicitDates = question.match(/(\d{4}-\d{2}-\d{2})\s*(?:至|到|~|～|—|–|\bto\b)\s*(\d{4}-\d{2}-\d{2})/i);
  if (explicitDates) {
    const start = parseDay(explicitDates[1]);
    const inclusiveEnd = parseDay(explicitDates[2]);
    if (start && inclusiveEnd && inclusiveEnd >= start) {
      const end = new Date(inclusiveEnd.getTime() + dayMs);
      return makeRange(start, end, `${explicitDates[1]} 至 ${explicitDates[2]}`);
    }
  }

  const end = new Date(now);
  if (/上个月|上月|last month|mese scorso|mese precedente/i.test(question)) {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
    const monthEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return makeRange(start, monthEnd, `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月`);
  }
  if (/本月|这个月|當月|this month|month to date|questo mese|mese corrente|da inizio mese/i.test(question)) {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return makeRange(start, end, `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月至今`);
  }
  if (/上周|上星期|last week|settimana scorsa|settimana precedente/i.test(question)) {
    const thisMonday = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    const weekday = (thisMonday.getUTCDay() + 6) % 7;
    thisMonday.setUTCDate(thisMonday.getUTCDate() - weekday);
    const start = new Date(thisMonday.getTime() - 7 * dayMs);
    return makeRange(start, thisMonday, `${start.toISOString().slice(0, 10)} 至 ${new Date(thisMonday.getTime() - dayMs).toISOString().slice(0, 10)}`);
  }
  if (/本周|这周|本星期|this week|week to date|questa settimana|settimana corrente|da inizio settimana/i.test(question)) {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    const weekday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - weekday);
    return makeRange(start, end, `${start.toISOString().slice(0, 10)} 至今`);
  }
  if (/今天|今日|today|oggi/i.test(question)) {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    return makeRange(start, end, start.toISOString().slice(0, 10));
  }
  const dayCountMatch = question.match(/(?:近|最近|过去|last|ultim[ie]|negli ultimi)\s*(\d{1,3})\s*(?:天|日|days?|giorni|giornate)/i);
  if (dayCountMatch) {
    const days = Math.max(1, Math.min(365, Number(dayCountMatch[1])));
    const start = new Date(end.getTime() - days * dayMs);
    return makeRange(start, end, `近${days}天`);
  }
  return makeRange(new Date(end.getTime() - 30 * dayMs), end, '近30天');
}
