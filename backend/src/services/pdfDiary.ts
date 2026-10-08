import fs from 'node:fs'
import PDFDocument from 'pdfkit'
import type { Reading, UserSettings } from '../domain'
import { zoneFor } from '../domain'
import { config } from '../config'
import { groupReadingsByDay, type DayRow } from '../utils/daySlots'
import { periodLabel, timeLabelFromIso } from '../utils/dates'

const COLORS = {
  title: '#1e3a5f',
  text: '#1f2937',
  muted: '#64748b',
  line: '#64748b',
  headerBg: '#1e3a5f',
  headerText: '#ffffff',
  low: '#0369a1',
  high: '#b91c1c',
}

type Column = { title: string; width: number }

/** Multi-day: date + morning×3 + evening×3; note takes the rest. */
const PERIOD_FIXED: Column[] = [
  { title: 'Дата', width: 48 },
  { title: 'АД', width: 64 },
  { title: 'ПД', width: 40 },
  { title: 'Пульс', width: 40 },
  { title: 'АД', width: 64 },
  { title: 'ПД', width: 40 },
  { title: 'Пульс', width: 40 },
]

/** Single day: every measurement as its own row. */
const DAY_FIXED: Column[] = [
  { title: 'Время', width: 48 },
  { title: 'АД', width: 72 },
  { title: 'ПД', width: 44 },
  { title: 'Пульс', width: 48 },
  { title: 'Аритмия', width: 56 },
]

const MIN_ROW_H = 24
const PERIOD_HEAD_H = 42
const DAY_HEAD_H = 26
const CELL_PAD_X = 3
const CELL_PAD_Y = 6
const BODY_SIZE = 9
const NOTE_SIZE = 8

function zoneColor(zone: 'low' | 'high' | 'normal'): string {
  if (zone === 'low') return COLORS.low
  if (zone === 'high') return COLORS.high
  return COLORS.text
}

function cleanNote(note: string): string {
  return note.replace(/\uFFFD/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
}

function formatDay(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`
}

function drawCentered(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  color: string,
  fontSize = BODY_SIZE,
): void {
  doc.save()
  doc.font('body').fontSize(fontSize).fillColor(color)
  const prevX = doc.x
  const prevY = doc.y
  doc.text(text, x, y, {
    width: w,
    align: 'center',
    lineBreak: false,
    height: fontSize + 4,
    ellipsis: true,
  })
  doc.x = prevX
  doc.y = prevY
  doc.restore()
}

function drawPressure(
  doc: PDFKit.PDFDocument,
  reading: Reading | null,
  x: number,
  textY: number,
  cellW: number,
  settings: UserSettings,
): void {
  if (!reading) {
    drawCentered(doc, '—', x, textY, cellW, COLORS.muted)
    return
  }
  const sys = String(reading.systolic)
  const dia = String(reading.diastolic)
  const slash = '/'
  const sysColor = zoneColor(zoneFor(reading.systolic, settings.sysMin, settings.sysMax))
  const diaColor = zoneColor(zoneFor(reading.diastolic, settings.diaMin, settings.diaMax))

  if (sysColor === diaColor) {
    drawCentered(doc, `${sys}${slash}${dia}`, x, textY, cellW, sysColor)
    return
  }

  doc.save()
  doc.font('body').fontSize(BODY_SIZE)
  const total = doc.widthOfString(sys) + doc.widthOfString(slash) + doc.widthOfString(dia)
  let cursor = x + Math.max(0, (cellW - total) / 2)
  const prevX = doc.x
  const prevY = doc.y

  doc.fillColor(sysColor).text(sys, cursor, textY, { lineBreak: false })
  cursor += doc.widthOfString(sys)
  doc.fillColor(COLORS.text).text(slash, cursor, textY, { lineBreak: false })
  cursor += doc.widthOfString(slash)
  doc.fillColor(diaColor).text(dia, cursor, textY, { lineBreak: false })

  doc.x = prevX
  doc.y = prevY
  doc.restore()
}

export function buildDiaryPdf(options: {
  readings: Reading[]
  bounds: UserSettings
  from: string
  to: string
}): Promise<Buffer> {
  const { readings, bounds, from, to } = options
  const singleDay = from === to

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(config.fontPath)) {
      reject(new Error(`Font not found: ${config.fontPath}`))
      return
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: { Title: 'Дневник измерения АД', Author: 'Дневник' },
      autoFirstPage: true,
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.registerFont('body', config.fontPath)
    doc.font('body')

    const left = doc.page.margins.left
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const fixed = singleDay ? DAY_FIXED : PERIOD_FIXED
    const fixedWidth = fixed.reduce((sum, column) => sum + column.width, 0)
    const noteWidth = Math.max(80, width - fixedWidth)
    const columns: Column[] = [...fixed, { title: singleDay ? 'Примечание' : 'Примечания', width: noteWidth }]
    const label = periodLabel(from, to)
    const dayRows: DayRow[] = singleDay ? [] : groupReadingsByDay(readings, bounds)
    const readingRows = singleDay
      ? readings.slice().sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
      : []
    let pageNo = 1
    let headerInnerY = 0
    let tableTop = 0

    const bottom = () => doc.page.height - doc.page.margins.bottom - 32

    const col = (index: number): Column => {
      const column = columns[index]
      if (!column) throw new Error(`PDF column ${index} is missing`)
      return column
    }

    const columnX = (index: number): number => {
      let x = left
      for (let i = 0; i < index; i += 1) x += col(i).width
      return x
    }

    const strokeLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      options: { width?: number; opacity?: number } = {},
    ) => {
      doc.save()
      doc
        .moveTo(x1, y1)
        .lineTo(x2, y2)
        .strokeColor(COLORS.line)
        .strokeOpacity(options.opacity ?? 0.55)
        .lineWidth(options.width ?? 0.8)
        .stroke()
      doc.restore()
    }

    const drawAllVerticals = (fromY: number, toY: number, _options: { innerFromY?: number } = {}) => {
      strokeLine(left, fromY, left, toY, { opacity: 0.55, width: 0.9 })
      let x = left
      for (let i = 0; i < columns.length; i += 1) {
        x += col(i).width
        const isOuter = i === columns.length - 1
        strokeLine(x, fromY, x, toY, {
          opacity: isOuter ? 0.55 : 0.35,
          width: isOuter ? 0.9 : 0.65,
        })
      }
    }

    // Period grid: group edges always; АД/ПД/Пульс only below Утро/Вечер titles.
    const GROUP_AFTER = new Set([0, 3, 6, 7])
    const INNER_AFTER = new Set([1, 2, 4, 5])
    const drawPeriodVerticals = (fromY: number, toY: number, options: { innerFromY?: number } = {}) => {
      strokeLine(left, fromY, left, toY, { opacity: 0.55, width: 0.9 })
      let x = left
      for (let i = 0; i < columns.length; i += 1) {
        x += col(i).width
        const isOuter = i === columns.length - 1
        if (GROUP_AFTER.has(i)) {
          strokeLine(x, fromY, x, toY, { opacity: isOuter ? 0.55 : 0.4, width: isOuter ? 0.9 : 0.75 })
          continue
        }
        if (INNER_AFTER.has(i)) {
          const start = options.innerFromY ?? fromY
          strokeLine(x, start, x, toY, { opacity: 0.28, width: 0.65 })
        }
      }
    }

    const drawVerticals = singleDay ? drawAllVerticals : drawPeriodVerticals

    const drawFooter = () => {
      const savedX = doc.x
      const savedY = doc.y
      doc
        .font('body')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          'ПД — пульсовое давление (верхнее − нижнее). Пример: 120/80 → 40.',
          left,
          doc.page.height - doc.page.margins.bottom - 16,
          { width, height: 18, lineBreak: true },
        )
      doc.x = savedX
      doc.y = savedY
    }

    const drawHeader = (): number => {
      const prevX = doc.x
      const prevY = doc.y
      doc.font('body').fontSize(18).fillColor(COLORS.title).text('Дневник измерения АД', left, 36, {
        width,
        lineBreak: false,
      })
      doc
        .fontSize(11)
        .fillColor(COLORS.muted)
        .text(`Период: ${label}`, left, 58, { width: width - 48, lineBreak: false })
      doc.fontSize(9).text(`Стр. ${pageNo}`, left, 58, { width, align: 'right', lineBreak: false })
      doc.x = prevX
      doc.y = prevY
      return 78
    }

    const drawDayTableHead = (y: number): number => {
      doc.save()
      doc.rect(left, y, width, DAY_HEAD_H).fill(COLORS.headerBg)
      doc.restore()

      const prevX = doc.x
      const prevY = doc.y
      doc.font('body').fontSize(9).fillColor(COLORS.headerText)
      for (let i = 0; i < columns.length; i += 1) {
        doc.text(col(i).title, columnX(i), y + 7, {
          width: col(i).width,
          align: 'center',
          lineBreak: false,
        })
      }
      doc.x = prevX
      doc.y = prevY

      tableTop = y
      headerInnerY = y
      strokeLine(left, y, left + width, y, { opacity: 0.7, width: 1 })
      strokeLine(left, y + DAY_HEAD_H, left + width, y + DAY_HEAD_H, { opacity: 0.7, width: 1 })
      drawVerticals(y, y + DAY_HEAD_H)
      return y + DAY_HEAD_H
    }

    const drawPeriodTableHead = (y: number): number => {
      const morningX = columnX(1)
      const eveningX = columnX(4)
      const morningW = col(1).width + col(2).width + col(3).width
      const eveningW = col(4).width + col(5).width + col(6).width
      const bandY = y + 18

      doc.save()
      doc.rect(left, y, width, PERIOD_HEAD_H).fill(COLORS.headerBg)
      doc.restore()

      const prevX = doc.x
      const prevY = doc.y
      doc.font('body').fontSize(9).fillColor(COLORS.headerText)

      doc.text('Утро', morningX, y + 4, { width: morningW, align: 'center', lineBreak: false })
      doc.text('Вечер', eveningX, y + 4, { width: eveningW, align: 'center', lineBreak: false })

      doc.text('Дата', columnX(0), y + PERIOD_HEAD_H / 2 - 5, {
        width: col(0).width,
        align: 'center',
        lineBreak: false,
      })
      doc.text('Примечания', columnX(7), y + PERIOD_HEAD_H / 2 - 5, {
        width: noteWidth,
        align: 'center',
        lineBreak: false,
      })

      const subY = y + 24
      for (const index of [1, 2, 3, 4, 5, 6]) {
        doc.text(col(index).title, columnX(index), subY, {
          width: col(index).width,
          align: 'center',
          lineBreak: false,
        })
      }

      doc.x = prevX
      doc.y = prevY

      tableTop = y
      headerInnerY = bandY
      strokeLine(left, y, left + width, y, { opacity: 0.7, width: 1 })
      strokeLine(left, y + PERIOD_HEAD_H, left + width, y + PERIOD_HEAD_H, { opacity: 0.7, width: 1 })
      strokeLine(morningX, bandY, eveningX + eveningW, bandY, { opacity: 0.35, width: 0.6 })
      drawVerticals(y, y + PERIOD_HEAD_H, { innerFromY: headerInnerY })
      return y + PERIOD_HEAD_H
    }

    const drawTableHead = singleDay ? drawDayTableHead : drawPeriodTableHead

    let y = drawHeader()
    y = drawTableHead(y)
    drawFooter()

    const empty = singleDay ? readingRows.length === 0 : dayRows.length === 0
    if (empty) {
      doc.fontSize(11).fillColor(COLORS.muted).text(
        singleDay ? 'Нет записей за этот день' : 'Нет записей за этот период',
        left + CELL_PAD_X,
        y + 10,
        { width },
      )
      doc.end()
      return
    }

    const ensureSpace = (rowHeight: number): number => {
      if (y + rowHeight <= bottom()) return rowHeight
      drawVerticals(tableTop, y, { innerFromY: headerInnerY })
      strokeLine(left, y, left + width, y, { opacity: 0.7, width: 1 })
      doc.addPage()
      pageNo += 1
      y = drawHeader()
      y = drawTableHead(y)
      drawFooter()
      const available = bottom() - y
      return Math.min(rowHeight, Math.max(MIN_ROW_H, available))
    }

    if (singleDay) {
      readingRows.forEach((row) => {
        const note = cleanNote(row.note)
        doc.font('body').fontSize(NOTE_SIZE)
        const noteHeight = note ? doc.heightOfString(note, { width: noteWidth - CELL_PAD_X * 2 }) : 0
        let rowHeight = ensureSpace(Math.max(MIN_ROW_H, noteHeight + CELL_PAD_Y * 2))
        const textY = y + CELL_PAD_Y
        const cell = (index: number) => ({ x: columnX(index), w: col(index).width })

        drawCentered(doc, timeLabelFromIso(row.measuredAt), cell(0).x, textY, cell(0).w, COLORS.text)
        drawPressure(doc, row, cell(1).x, textY, cell(1).w, bounds)
        drawCentered(doc, String(row.systolic - row.diastolic), cell(2).x, textY, cell(2).w, COLORS.text)
        drawCentered(
          doc,
          String(row.pulse),
          cell(3).x,
          textY,
          cell(3).w,
          zoneColor(zoneFor(row.pulse, bounds.pulseMin, bounds.pulseMax)),
        )
        drawCentered(doc, row.arrhythmia ? 'да' : '', cell(4).x, textY, cell(4).w, COLORS.text)

        if (note) {
          const prevX = doc.x
          const prevY = doc.y
          doc.save()
          doc.font('body').fontSize(NOTE_SIZE).fillColor(COLORS.text)
          doc.text(note, columnX(5) + CELL_PAD_X, textY, {
            width: noteWidth - CELL_PAD_X * 2,
            height: Math.max(8, rowHeight - CELL_PAD_Y * 2),
            lineBreak: true,
            ellipsis: true,
          })
          doc.restore()
          doc.x = prevX
          doc.y = prevY
        }

        strokeLine(left, y + rowHeight, left + width, y + rowHeight, { opacity: 0.45, width: 0.8 })
        y += rowHeight
      })
    } else {
      dayRows.forEach((row) => {
        const note = cleanNote(row.note)
        doc.font('body').fontSize(NOTE_SIZE)
        const noteHeight = note ? doc.heightOfString(note, { width: noteWidth - CELL_PAD_X * 2 }) : 0
        let rowHeight = ensureSpace(Math.max(MIN_ROW_H, noteHeight + CELL_PAD_Y * 2))
        const textY = y + CELL_PAD_Y
        const cell = (index: number) => ({ x: columnX(index), w: col(index).width })

        drawCentered(doc, formatDay(row.date), cell(0).x, textY, cell(0).w, COLORS.text)

        drawPressure(doc, row.morning, cell(1).x, textY, cell(1).w, bounds)
        drawCentered(
          doc,
          row.morning ? String(row.morning.systolic - row.morning.diastolic) : '—',
          cell(2).x,
          textY,
          cell(2).w,
          COLORS.text,
        )
        drawCentered(
          doc,
          row.morning ? String(row.morning.pulse) : '—',
          cell(3).x,
          textY,
          cell(3).w,
          row.morning ? zoneColor(zoneFor(row.morning.pulse, bounds.pulseMin, bounds.pulseMax)) : COLORS.muted,
        )

        drawPressure(doc, row.evening, cell(4).x, textY, cell(4).w, bounds)
        drawCentered(
          doc,
          row.evening ? String(row.evening.systolic - row.evening.diastolic) : '—',
          cell(5).x,
          textY,
          cell(5).w,
          COLORS.text,
        )
        drawCentered(
          doc,
          row.evening ? String(row.evening.pulse) : '—',
          cell(6).x,
          textY,
          cell(6).w,
          row.evening ? zoneColor(zoneFor(row.evening.pulse, bounds.pulseMin, bounds.pulseMax)) : COLORS.muted,
        )

        if (note) {
          const prevX = doc.x
          const prevY = doc.y
          doc.save()
          doc.font('body').fontSize(NOTE_SIZE).fillColor(COLORS.text)
          doc.text(note, columnX(7) + CELL_PAD_X, textY, {
            width: noteWidth - CELL_PAD_X * 2,
            height: Math.max(8, rowHeight - CELL_PAD_Y * 2),
            lineBreak: true,
            ellipsis: true,
          })
          doc.restore()
          doc.x = prevX
          doc.y = prevY
        }

        strokeLine(left, y + rowHeight, left + width, y + rowHeight, { opacity: 0.45, width: 0.8 })
        y += rowHeight
      })
    }

    drawVerticals(tableTop, y, { innerFromY: headerInnerY })
    strokeLine(left, tableTop, left + width, tableTop, { opacity: 0.7, width: 1 })

    doc.end()
  })
}
