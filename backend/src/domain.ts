export const TZ = 'Europe/Minsk'

export const ABS = {
  sys: { min: 70, max: 250 },
  dia: { min: 40, max: 150 },
  pulse: { min: 30, max: 220 },
} as const

export const DEFAULT_BOUNDS: Bounds = {
  sysMin: 100,
  sysMax: 134,
  diaMin: 60,
  diaMax: 84,
  pulseMin: 60,
  pulseMax: 100,
}

export const DEFAULT_MORNING_START = '03:00'
export const DEFAULT_MORNING_END = '15:00'

export type Bounds = {
  sysMin: number
  sysMax: number
  diaMin: number
  diaMax: number
  pulseMin: number
  pulseMax: number
}

export type UserSettings = Bounds & {
  morningStart: string
  morningEnd: string
}

export const DEFAULT_SETTINGS: UserSettings = {
  ...DEFAULT_BOUNDS,
  morningStart: DEFAULT_MORNING_START,
  morningEnd: DEFAULT_MORNING_END,
}

export type DaySlot = 'morning' | 'evening'

export type Reading = {
  id: string
  userId: number
  measuredAt: string
  date: string
  systolic: number
  diastolic: number
  pulse: number
  arrhythmia: boolean
  note: string
  createdAt: string
  updatedAt: string
}

export type Zone = 'low' | 'high' | 'normal'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export function zoneFor(value: number, min: number, max: number): Zone {
  if (value < min) return 'low'
  if (value > max) return 'high'
  return 'normal'
}

export function isHigh(reading: Pick<Reading, 'systolic' | 'diastolic' | 'pulse'>, bounds: Bounds): boolean {
  return (
    reading.systolic > bounds.sysMax ||
    reading.diastolic > bounds.diaMax ||
    reading.pulse > bounds.pulseMax
  )
}

export function isLow(reading: Pick<Reading, 'systolic' | 'diastolic' | 'pulse'>, bounds: Bounds): boolean {
  return (
    reading.systolic < bounds.sysMin ||
    reading.diastolic < bounds.diaMin ||
    reading.pulse < bounds.pulseMin
  )
}

/** High wins, so a day bar turns red if any value that day is above the limit. */
export function combinedZone(
  reading: Pick<Reading, 'systolic' | 'diastolic' | 'pulse'>,
  bounds: Bounds,
): Zone {
  if (isHigh(reading, bounds)) return 'high'
  if (isLow(reading, bounds)) return 'low'
  return 'normal'
}

function isInt(value: number): boolean {
  return Number.isInteger(value)
}

export function validateBounds(bounds: Bounds): string | null {
  const pairs: Array<[number, number, number, number, string]> = [
    [bounds.sysMin, bounds.sysMax, ABS.sys.min, ABS.sys.max, 'Верхнее'],
    [bounds.diaMin, bounds.diaMax, ABS.dia.min, ABS.dia.max, 'Нижнее'],
    [bounds.pulseMin, bounds.pulseMax, ABS.pulse.min, ABS.pulse.max, 'Пульс'],
  ]
  for (const [min, max, absMin, absMax, label] of pairs) {
    if (!isInt(min) || !isInt(max)) return `${label}: укажите целые числа`
    if (min < absMin || max > absMax) return `${label}: от ${absMin} до ${absMax}`
    if (min >= max) return `${label}: нижняя граница должна быть меньше верхней`
  }
  return null
}

export function validateReadingValues(systolic: number, diastolic: number, pulse: number): string | null {
  if (!isInt(systolic) || systolic < ABS.sys.min || systolic > ABS.sys.max) {
    return `Верхнее: от ${ABS.sys.min} до ${ABS.sys.max}`
  }
  if (!isInt(diastolic) || diastolic < ABS.dia.min || diastolic > ABS.dia.max) {
    return `Нижнее: от ${ABS.dia.min} до ${ABS.dia.max}`
  }
  if (systolic <= diastolic) return 'Верхнее давление должно быть больше нижнего'
  if (!isInt(pulse) || pulse < ABS.pulse.min || pulse > ABS.pulse.max) {
    return `Пульс: от ${ABS.pulse.min} до ${ABS.pulse.max}`
  }
  return null
}

const ID_RE = /^[A-Za-z0-9-]{8,64}$/

export type ReadingInput = {
  id: string
  measuredAt: string
  systolic: number
  diastolic: number
  pulse: number
  arrhythmia: boolean
  note: string
  createdAt?: string
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

export function parseReadingInput(body: unknown): ReadingInput {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Некорректное тело')
  const raw = body as Record<string, unknown>
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!ID_RE.test(id)) throw new HttpError(400, 'Некорректный id')

  const measuredAt = typeof raw.measuredAt === 'string' ? raw.measuredAt : ''
  const when = new Date(measuredAt)
  if (!measuredAt || Number.isNaN(when.getTime())) throw new HttpError(400, 'Укажите дату и время')

  const systolic = asInt(raw.systolic)
  const diastolic = asInt(raw.diastolic)
  const pulse = asInt(raw.pulse)
  if (systolic == null || diastolic == null || pulse == null) {
    throw new HttpError(400, 'Заполните верхнее, нижнее и пульс')
  }
  const problem = validateReadingValues(systolic, diastolic, pulse)
  if (problem) throw new HttpError(400, problem)

  let note = ''
  if (typeof raw.note === 'string') {
    note = raw.note.replace(/\uFFFD/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
  }
  if (note.length > 500) throw new HttpError(400, 'Примечание длиннее 500 символов')

  const arrhythmia = raw.arrhythmia === true || raw.arrhythmia === 1 || raw.arrhythmia === '1'
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : undefined

  return {
    id,
    measuredAt: when.toISOString(),
    systolic,
    diastolic,
    pulse,
    arrhythmia,
    note,
    ...(createdAt ? { createdAt } : {}),
  }
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function validateMorningWindow(start: string, end: string): string | null {
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return 'Укажите время утра в формате ЧЧ:ММ'
  if (start === end) return 'Начало и конец утра не должны совпадать'
  return null
}

export function parseUserSettings(body: unknown): UserSettings {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Некорректное тело')
  const raw = body as Record<string, unknown>
  const pick = (key: keyof Bounds): number => {
    const value = asInt(raw[key])
    if (value == null) throw new HttpError(400, 'Укажите все границы целыми числами')
    return value
  }
  const bounds: Bounds = {
    sysMin: pick('sysMin'),
    sysMax: pick('sysMax'),
    diaMin: pick('diaMin'),
    diaMax: pick('diaMax'),
    pulseMin: pick('pulseMin'),
    pulseMax: pick('pulseMax'),
  }
  const problem = validateBounds(bounds)
  if (problem) throw new HttpError(400, problem)

  const morningStart =
    typeof raw.morningStart === 'string' && raw.morningStart.trim()
      ? raw.morningStart.trim()
      : DEFAULT_MORNING_START
  const morningEnd =
    typeof raw.morningEnd === 'string' && raw.morningEnd.trim()
      ? raw.morningEnd.trim()
      : DEFAULT_MORNING_END
  const windowProblem = validateMorningWindow(morningStart, morningEnd)
  if (windowProblem) throw new HttpError(400, windowProblem)

  return { ...bounds, morningStart, morningEnd }
}

/** @deprecated use parseUserSettings */
export function parseBounds(body: unknown): Bounds {
  return parseUserSettings(body)
}
