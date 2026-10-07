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

export type Bounds = {
  sysMin: number
  sysMax: number
  diaMin: number
  diaMax: number
  pulseMin: number
  pulseMax: number
}

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

export function combinedZone(
  reading: Pick<Reading, 'systolic' | 'diastolic' | 'pulse'>,
  bounds: Bounds,
): Zone {
  if (isHigh(reading, bounds)) return 'high'
  if (isLow(reading, bounds)) return 'low'
  return 'normal'
}

export function validateBounds(bounds: Bounds): string | null {
  const pairs: Array<[number, number, number, number, string]> = [
    [bounds.sysMin, bounds.sysMax, ABS.sys.min, ABS.sys.max, 'Верхнее'],
    [bounds.diaMin, bounds.diaMax, ABS.dia.min, ABS.dia.max, 'Нижнее'],
    [bounds.pulseMin, bounds.pulseMax, ABS.pulse.min, ABS.pulse.max, 'Пульс'],
  ]
  for (const [min, max, absMin, absMax, label] of pairs) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) return `${label}: укажите целые числа`
    if (min < absMin || max > absMax) return `${label}: от ${absMin} до ${absMax}`
    if (min >= max) return `${label}: нижняя граница должна быть меньше верхней`
  }
  return null
}

export function validateReadingValues(systolic: number, diastolic: number, pulse: number): string | null {
  if (!Number.isInteger(systolic) || systolic < ABS.sys.min || systolic > ABS.sys.max) {
    return `Верхнее: от ${ABS.sys.min} до ${ABS.sys.max}`
  }
  if (!Number.isInteger(diastolic) || diastolic < ABS.dia.min || diastolic > ABS.dia.max) {
    return `Нижнее: от ${ABS.dia.min} до ${ABS.dia.max}`
  }
  if (systolic <= diastolic) return 'Верхнее давление должно быть больше нижнего'
  if (!Number.isInteger(pulse) || pulse < ABS.pulse.min || pulse > ABS.pulse.max) {
    return `Пульс: от ${ABS.pulse.min} до ${ABS.pulse.max}`
  }
  return null
}

/** Drop replacement glyphs and control chars left by a bad encoding. */
export function cleanNote(note: string): string {
  return note.replace(/\uFFFD/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
}

export function parseWhole(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}
