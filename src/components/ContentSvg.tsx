import type { EditElement, PageMeta } from '../types'
import {
  ASCENT_RATIO,
  FONT_FAMILY,
  LINE_HEIGHT_RATIO,
  fontCssWeight,
  wrapText,
} from '../utils/textLayout'

interface Props {
  page: PageMeta
  elements: EditElement[]
  /** ids currently being inline-edited; their SVG copy is hidden */
  hideIds: string[]
}

/**
 * Draws all overlay elements for the current page inside one SVG.
 * The SVG uses PDF-point coordinates (viewBox = page size) and is scaled by CSS,
 * so preview geometry matches the exported PDF 1:1.
 */
export default function ContentSvg({ page, elements, hideIds }: Props) {
  const hidden = new Set(hideIds)
  return (
    <svg
      className="content-svg"
      width={page.width}
      height={page.height}
      viewBox={`0 0 ${page.width} ${page.height}`}
      preserveAspectRatio="none"
    >
      {elements.map((el) => renderElement(el, page, hidden))}
    </svg>
  )
}

function renderElement(el: EditElement, page: PageMeta, hidden: Set<string>) {
  if (el.pageId !== page.id) return null
  switch (el.kind) {
    case 'textEdit': {
      // the cover stays at the ORIGINAL location (hiding the source text)
      // while the replacement text itself can be dragged anywhere
      const orig = el.origRect ?? el.rect
      const cover = (
        <rect
          key={el.id}
          x={orig.x}
          y={orig.y}
          width={orig.w}
          height={orig.h}
          fill={el.bg || '#ffffff'}
        />
      )
      if (hidden.has(el.id)) return cover
      return (
        <g key={el.id}>
          {cover}
          <text
            x={el.rect.x}
            y={el.baselineTop}
            fontSize={el.fontSize}
            fontFamily={FONT_FAMILY}
            fontWeight={fontCssWeight(el.font)}
            fill={el.color}
            style={{ whiteSpace: 'pre' }}
          >
            {el.text}
          </text>
        </g>
      )
    }
    case 'textBox': {
      if (hidden.has(el.id)) return null
      const lines = wrapText(el.text, el.fontSize, el.width, el.font === 'bold')
      const anchor = el.align === 'left' ? 'start' : el.align === 'center' ? 'middle' : 'end'
      const x =
        el.align === 'left' ? el.x : el.align === 'center' ? el.x + el.width / 2 : el.x + el.width
      return (
        <text
          key={el.id}
          fontSize={el.fontSize}
          fontFamily={FONT_FAMILY}
          fontWeight={fontCssWeight(el.font)}
          fill={el.color}
          textAnchor={anchor}
        >
          {lines.map((ln, i) => (
            <tspan
              key={i}
              x={x}
              y={el.y + ASCENT_RATIO * el.fontSize + i * el.fontSize * LINE_HEIGHT_RATIO}
            >
              {ln || ' '}
            </tspan>
          ))}
        </text>
      )
    }
    case 'shape': {
      if (el.shape === 'line') {
        return (
          <line
            key={el.id}
            x1={el.x}
            y1={el.y}
            x2={el.x + el.w}
            y2={el.y + el.h}
            stroke={el.stroke || el.fill || '#111111'}
            strokeWidth={Math.max(0.5, el.strokeWidth)}
            strokeLinecap="round"
          />
        )
      }
      return el.shape === 'rect' ? (
        <rect
          key={el.id}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          fill={el.fill || 'none'}
          stroke={el.stroke || 'none'}
          strokeWidth={el.strokeWidth || undefined}
        />
      ) : (
        <ellipse
          key={el.id}
          cx={el.x + el.w / 2}
          cy={el.y + el.h / 2}
          rx={Math.max(0.5, el.w / 2)}
          ry={Math.max(0.5, el.h / 2)}
          fill={el.fill || 'none'}
          stroke={el.stroke || 'none'}
          strokeWidth={el.strokeWidth || undefined}
        />
      )
    }
    case 'image': {
      return (
        <image
          key={el.id}
          href={el.dataUrl}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          preserveAspectRatio="none"
        />
      )
    }
    default:
      return null
  }
}
