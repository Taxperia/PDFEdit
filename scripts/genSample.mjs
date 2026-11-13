// Generates public/sample.pdf — a sample document for testing the editor.
// Run: npm run gen:sample
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const fontReg = await readFile(path.join(root, 'public', 'fonts', 'NotoSans-Regular.ttf'))
const fontBold = await readFile(path.join(root, 'public', 'fonts', 'NotoSans-Bold.ttf'))

const doc = await PDFDocument.create()
doc.registerFontkit(fontkit)
const regular = await doc.embedFont(fontReg, { subset: true })
const bold = await doc.embedFont(fontBold, { subset: true })

const A4 = [595.28, 841.89]
const page1 = doc.addPage(A4)
const page2 = doc.addPage(A4)

const ink = rgb(0.12, 0.16, 0.22)
const muted = rgb(0.42, 0.47, 0.55)
const blue = rgb(0.15, 0.39, 0.92)
const navy = rgb(0.12, 0.23, 0.54)

// ---------------- page 1 ----------------
page1.drawRectangle({ x: 0, y: 742, width: 595.28, height: 100, color: rgb(0.96, 0.97, 0.99) })
page1.drawText('PDFEdit Sample Document', {
  x: 60, y: 786, size: 26, font: bold, color: ink,
})
page1.drawText('A sample document for trying the PDFEdit browser editor.', {
  x: 60, y: 758, size: 13, font: regular, color: muted,
})

page1.drawLine({
  start: { x: 60, y: 726 },
  end: { x: 535, y: 726 },
  thickness: 1,
  color: rgb(0.85, 0.87, 0.9),
})

page1.drawText('Hello! Click a text line to start editing.', {
  x: 60, y: 690, size: 14, font: bold, color: ink,
})
page1.drawText(
  'Edit existing text, or add a text box, shape, line, or image.',
  { x: 60, y: 668, size: 12, font: regular, color: ink },
)
page1.drawText(
  'Use the Pages panel to navigate, insert, reorder, and remove pages.',
  { x: 60, y: 650, size: 12, font: regular, color: ink },
)
page1.drawText('Choose Export PDF to download your changes. Your source stays unchanged.', {
  x: 60, y: 632, size: 12, font: regular, color: ink,
})

// info box (colored background behind text — tests cover-color sampling)
page1.drawRectangle({ x: 60, y: 470, width: 475, height: 110, color: rgb(0.86, 0.9, 0.98) })
page1.drawRectangle({ x: 60, y: 470, width: 6, height: 110, color: blue })
page1.drawText('Sample invoice', { x: 82, y: 544, size: 15, font: bold, color: navy })
page1.drawText('Total: $1,250.00', { x: 82, y: 520, size: 12.5, font: regular, color: navy })
page1.drawText('Due date: November 30, 2026', { x: 82, y: 498, size: 12.5, font: regular, color: navy })

// simple table
const rows = [
  ['Item', 'Quantity', 'Price'],
  ['Pen set', '12', '$240.00'],
  ['Notebook (A5)', '25', '$375.00'],
  ['Bag', '5', '$635.00'],
]
const colX = [60, 260, 420]
let y = 430
for (let i = 0; i < rows.length; i++) {
  for (let c = 0; c < rows[i].length; c++) {
    page1.drawText(rows[i][c], {
      x: colX[c],
      y,
      size: 12,
      font: i === 0 ? bold : regular,
      color: i === 0 ? ink : rgb(0.25, 0.3, 0.38),
    })
  }
  y -= 30
  page1.drawLine({
    start: { x: 60, y: y + 22 },
    end: { x: 535, y: y + 22 },
    thickness: 0.7,
    color: rgb(0.88, 0.9, 0.93),
  })
}

page1.drawText('PDFEdit · Sample document · All figures are fictional', {
  x: 60, y: 60, size: 10, font: regular, color: muted,
})

// ---------------- page 2 ----------------
page2.drawRectangle({ x: 0, y: 762, width: 595.28, height: 80, color: navy })
page2.drawText('Monthly Report — November 2026', {
  x: 60, y: 802, size: 22, font: bold, color: rgb(1, 1, 1),
})

page2.drawText('Highlights', {
  x: 60, y: 700, size: 16, font: bold, color: ink,
})
const bullets = [
  'Sales increased by 12% compared with the previous month.',
  'New customers: 148 (96% of the target).',
  'Average support response time decreased to 2.4 hours.',
  'The inventory review will finish at the end of November.',
]
let by = 672
for (const b of bullets) {
  page2.drawCircle({ x: 66, y: by + 4, size: 3, color: blue })
  page2.drawText(b, { x: 80, y: by, size: 12, font: regular, color: ink })
  by -= 26
}

page2.drawEllipse({
  x: 120,
  y: 300,
  xScale: 70,
  yScale: 70,
  color: rgb(0.98, 0.75, 0.25),
  borderColor: rgb(0.71, 0.47, 0.04),
  borderWidth: 1.5,
})
page2.drawText('96%', { x: 100, y: 292, size: 20, font: bold, color: rgb(0.3, 0.2, 0) })
page2.drawText('Target completion', { x: 60, y: 210, size: 11, font: regular, color: muted })

page2.drawText('This page demonstrates light text on dark backgrounds and shapes.', {
  x: 60, y: 100, size: 11, font: regular, color: muted,
})

const out = await doc.save()
await mkdir(path.join(root, 'public'), { recursive: true })
await writeFile(path.join(root, 'public', 'sample.pdf'), out)
console.log('Wrote public/sample.pdf:', out.length, 'bytes')
