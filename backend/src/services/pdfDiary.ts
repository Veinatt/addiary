import fs from 'node:fs'
import PDFDocument from 'pdfkit'
import type { Bounds, Reading } from '../domain'
import { zoneFor } from '../domain'
import { config } from '../config'
import { periodLabel, shortDateFromIso, timeLabelFromIso } from '../utils/dates'

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

const FIXED: Column[] = [
  { title: 'Дата', width: 72 },
  { title: 'Время', width: 52 },
  { title: 'Давление', width: 78 },
  { title: 'Пульсовое', width: 72 },
  { title: 'Пульс', width: 48 },
  { title: 'Аритмия', width: 62 },
]

const MIN_ROW_H = 26
const HEAD_H = 28
const CELL_PAD_X = 5
const CELL_PAD_Y = 7

function zoneColor(zone: 'low' | 'high' | 'normal'): string {
  if (zone === 'low') return COLORS.low
  if (zone === 'high') return COLORS.high
  return COLORS.text
}

function cleanNote(note: string): string {
  return note.replace(/\uFFFD/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
}

export function buildDiaryPdf(options: {
  readings: Reading[]
  bounds: Bounds
  from: string
  to: string
}): Promise<Buffer> {
  const { readings, bounds, from, to } = options
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(config.fontPath)) {
      reject(new Error(`Font not found: ${config.fontPath}`))
      return
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: { Title: 'Дневник', Author: 'Дневник' },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.registerFont('body', config.fontPath)
    doc.font('body')

    const left = doc.page.margins.left
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const noteWidth = width - FIXED.reduce((sum, column) => sum + column.width, 0)
    const columns: Column[] = [...FIXED, { title: 'Примечание', width: noteWidth }]
    const label = periodLabel(from, to)
    let pageNo = 1
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

    const drawVerticals = (fromY: number, toY: number) => {
      strokeLine(left, fromY, left, toY, { opacity: 0.55, width: 0.9 })
      let x = left
      for (let i = 0; i < columns.length; i += 1) {
        x += col(i).width
        const isOuter = i === columns.length - 1
        strokeLine(x, fromY, x, toY, { opacity: isOuter ? 0.55 : 0.28, width: isOuter ? 0.9 : 0.7 })
      }
    }

    const drawFooter = () => {
      const saved = doc.y
      doc
        .font('body')
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          'Пульсовое давление — разница между верхним и нижним. Пример: 120 / 80, пульсовое 40.',
          left,
          doc.page.height - doc.page.margins.bottom - 18,
          { width, height: 22, lineBreak: true },
        )
      doc.y = saved
    }

    const drawHeader = (): number => {
      doc.font('body').fontSize(22).fillColor(COLORS.title).text('Дневник', left, 40, { width })
      doc
        .fontSize(11)
        .fillColor(COLORS.muted)
        .text(`Период: ${label}`, left, doc.y + 4, { width })
      doc.fontSize(9).text(`Стр. ${pageNo}`, left, doc.y + 2, { width, align: 'right' })
      return doc.y + 14
    }

    const drawTableHead = (y: number): number => {
      doc.save()
      doc.rect(left, y, width, HEAD_H).fill(COLORS.headerBg)
      doc.restore()
      doc.font('body').fontSize(10).fillColor(COLORS.headerText)
      columns.forEach((column, index) => {
        const x = columnX(index)
        doc.text(column.title, x + CELL_PAD_X, y + 8, {
          width: column.width - CELL_PAD_X * 2,
          lineBreak: false,
        })
      })
      tableTop = y
      strokeLine(left, y, left + width, y, { opacity: 0.7, width: 1 })
      strokeLine(left, y + HEAD_H, left + width, y + HEAD_H, { opacity: 0.7, width: 1 })
      drawVerticals(y, y + HEAD_H)
      return y + HEAD_H
    }

    const drawCellText = (text: string, x: number, textY: number, cellW: number, color: string) => {
      doc.save()
      doc.font('body').fontSize(10).fillColor(color)
      doc.text(text, x + CELL_PAD_X, textY, {
        width: cellW,
        lineBreak: false,
      })
      doc.restore()
    }

    let y = drawHeader()
    y = drawTableHead(y)
    drawFooter()

    const rows = [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    if (rows.length === 0) {
      doc.fontSize(11).fillColor(COLORS.muted).text('Нет записей за этот период', left + CELL_PAD_X, y + 10, {
        width,
      })
      doc.end()
      return
    }

    rows.forEach((reading) => {
      const note = cleanNote(reading.note)
      doc.font('body').fontSize(10)
      const noteHeight = note
        ? doc.heightOfString(note, { width: noteWidth - CELL_PAD_X * 2 })
        : 0
      let rowHeight = Math.max(MIN_ROW_H, noteHeight + CELL_PAD_Y * 2)

      if (y + rowHeight > bottom()) {
        drawVerticals(tableTop, y)
        strokeLine(left, y, left + width, y, { opacity: 0.7, width: 1 })
        doc.addPage()
        pageNo += 1
        y = drawHeader()
        y = drawTableHead(y)
        drawFooter()
      }

      // Extremely tall notes can still exceed one page body — clip instead of drawing past the footer.
      const available = bottom() - y
      if (rowHeight > available) {
        rowHeight = Math.max(MIN_ROW_H, available)
      }

      const textY = y + CELL_PAD_Y
      const sys = String(reading.systolic)
      const dia = String(reading.diastolic)
      const pulse = String(reading.pulse)
      const pulsePressure = String(reading.systolic - reading.diastolic)
      const arrhythmia = reading.arrhythmia ? 'да' : ''

      drawCellText(shortDateFromIso(reading.measuredAt), columnX(0), textY, col(0).width - CELL_PAD_X * 2, COLORS.text)
      drawCellText(timeLabelFromIso(reading.measuredAt), columnX(1), textY, col(1).width - CELL_PAD_X * 2, COLORS.text)

      {
        const x = columnX(2)
        const cellW = col(2).width - CELL_PAD_X * 2
        const sysColor = zoneColor(zoneFor(reading.systolic, bounds.sysMin, bounds.sysMax))
        const diaColor = zoneColor(zoneFor(reading.diastolic, bounds.diaMin, bounds.diaMax))
        doc.save()
        doc.font('body').fontSize(10)
        let cursor = x + CELL_PAD_X
        doc.fillColor(sysColor).text(sys, cursor, textY, { lineBreak: false, continued: false })
        cursor += doc.widthOfString(sys)
        doc.fillColor(COLORS.text).text(' / ', cursor, textY, { lineBreak: false, continued: false })
        cursor += doc.widthOfString(' / ')
        doc.fillColor(diaColor).text(dia, cursor, textY, {
          width: Math.max(8, x + CELL_PAD_X + cellW - cursor),
          lineBreak: false,
          continued: false,
        })
        doc.restore()
      }

      drawCellText(pulsePressure, columnX(3), textY, col(3).width - CELL_PAD_X * 2, COLORS.text)
      drawCellText(
        pulse,
        columnX(4),
        textY,
        col(4).width - CELL_PAD_X * 2,
        zoneColor(zoneFor(reading.pulse, bounds.pulseMin, bounds.pulseMax)),
      )
      drawCellText(arrhythmia, columnX(5), textY, col(5).width - CELL_PAD_X * 2, COLORS.text)

      if (note) {
        doc.save()
        doc.font('body').fontSize(10).fillColor(COLORS.text)
        doc.text(note, columnX(6) + CELL_PAD_X, textY, {
          width: noteWidth - CELL_PAD_X * 2,
          height: Math.max(8, rowHeight - CELL_PAD_Y * 2),
          lineBreak: true,
          ellipsis: true,
        })
        doc.restore()
      }

      strokeLine(left, y + rowHeight, left + width, y + rowHeight, { opacity: 0.45, width: 0.8 })
      y += rowHeight
    })

    drawVerticals(tableTop, y)
    strokeLine(left, tableTop, left + width, tableTop, { opacity: 0.7, width: 1 })

    doc.end()
  })
}
