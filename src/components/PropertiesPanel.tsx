import type { ReactElement } from 'react'
import { useDocStore } from '../store/useDocStore'
import { useI18n } from '../i18n/I18nContext'
import type { TKey } from '../i18n/translations'
import type { FontKey, ImageElement, ShapeElement, TextBoxElement, TextEditElement } from '../types'

type NumFn = (v: string, fallback: number) => number
type ColorRowFn = (
  label: string,
  value: string,
  set: (v: string) => void,
  allowNone?: { none: string; label: string },
) => ReactElement

interface RowProps {
  t: (k: TKey) => string
  num: NumFn
  fontRow: (font: FontKey, set: (f: FontKey) => void) => ReactElement
  sizeRow: (size: number, set: (n: number) => void) => ReactElement
  colorRow: ColorRowFn
}

function kindLabel(kind: string, shape?: string): TKey {
  switch (kind) {
    case 'textEdit':
      return 'kindTextEdit'
    case 'textBox':
      return 'kindTextBox'
    case 'image':
      return 'kindImage'
    case 'shape':
      return shape === 'rect' ? 'shapeRect' : shape === 'ellipse' ? 'shapeEllipse' : 'shapeLine'
  }
  return 'kindTextBox'
}

export default function PropertiesPanel() {
  const { t } = useI18n()
  const el = useDocStore((s) => s.elements.find((e) => e.id === s.selectedId) ?? null)
  const pages = useDocStore((s) => s.pages)
  const currentPageIdx = useDocStore((s) => s.currentPageIdx)

  const S = useDocStore.getState
  const num: NumFn = (v, fallback) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  }

  const fontRow = (font: FontKey, set: (f: FontKey) => void) => (
    <label className="prow">
      <span>{t('fontLabel')}</span>
      <select
        value={font}
        onFocus={() => S().pushHistory()}
        onChange={(e) => set(e.target.value as FontKey)}
      >
        <option value="regular">{t('regular')}</option>
        <option value="bold">{t('bold')}</option>
      </select>
    </label>
  )

  const sizeRow = (size: number, set: (n: number) => void) => (
    <label className="prow">
      <span>{t('sizeLabel')}</span>
      <input
        type="number"
        min={4}
        max={200}
        step={1}
        value={Math.round(size * 10) / 10}
        onFocus={() => S().pushHistory()}
        onChange={(e) => set(num(e.target.value, size))}
      />
    </label>
  )

  const colorRow: ColorRowFn = (label, value, set, allowNone) => (
    <label className="prow">
      <span>{label}</span>
      <span className="color-cell">
        <input
          type="color"
          value={value || '#000000'}
          disabled={!value && !!allowNone}
          onPointerDown={() => S().pushHistory()}
          onChange={(e) => set(e.target.value)}
        />
        {allowNone && (
          <button
            type="button"
            className={'chip' + (!value ? ' on' : '')}
            onClick={() => {
              S().pushHistory()
              set(value ? '' : allowNone.none)
            }}
          >
            {allowNone.label}
          </button>
        )}
      </span>
    </label>
  )

  if (!el) {
    return (
      <aside className="props">
        <div className="props-title">{t('props')}</div>
        <div className="props-empty">{t('noSelectionHint')}</div>
        <p className="cover-warning">{t('coverWarning')}</p>
        <div className="props-pageinfo">
          {t('page')} {currentPageIdx + 1} / {pages.length}
        </div>
      </aside>
    )
  }

  const header = (
    <div className="props-head">
      <span className="props-kind">{t(kindLabel(el.kind, el.kind === 'shape' ? el.shape : undefined))}</span>
      <div className="props-actions">
        <button title={t('duplicate')} onClick={() => S().duplicateElement(el.id)}>
          ⧉
        </button>
        <button title={t('bringFront')} onClick={() => S().reorderElement(el.id, 'front')}>
          ↑↑
        </button>
        <button title={t('sendBack')} onClick={() => S().reorderElement(el.id, 'back')}>
          ↓↓
        </button>
        <button
          title={t('delete')}
          className="danger"
          onClick={() => {
            S().pushHistory()
            S().deleteElement(el.id)
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )

  return (
    <aside className="props">
      {header}
      <p className="cover-warning">{t('coverWarning')}</p>

      {el.kind === 'textEdit' && (
        <TextEditProps el={el} t={t} num={num} fontRow={fontRow} sizeRow={sizeRow} colorRow={colorRow} />
      )}
      {el.kind === 'textBox' && (
        <TextBoxProps el={el} t={t} num={num} fontRow={fontRow} sizeRow={sizeRow} colorRow={colorRow} />
      )}
      {el.kind === 'shape' && <ShapeProps el={el} t={t} num={num} colorRow={colorRow} />}
      {el.kind === 'image' && <ImageProps el={el} t={t} num={num} />}
    </aside>
  )
}

function TextEditProps({ el, t, fontRow, sizeRow, colorRow }: RowProps & { el: TextEditElement }) {
  const S = useDocStore.getState
  return (
    <>
      <div className="pblock">
        <span className="plabel">{t('originalTextLabel')}</span>
        <div className="orig-text">{el.originalText}</div>
      </div>
      <label className="pblock">
        <span className="plabel">{t('textLabel')}</span>
        <textarea
          rows={3}
          value={el.text}
          onFocus={() => S().pushHistory()}
          onChange={(e) => S().updateElement(el.id, { text: e.target.value })}
        />
      </label>
      {sizeRow(el.fontSize, (n) => S().updateElement(el.id, { fontSize: n }))}
      {fontRow(el.font, (f) => S().updateElement(el.id, { font: f }))}
      {colorRow(t('colorLabel'), el.color, (v) => S().updateElement(el.id, { color: v }))}
      {colorRow(t('bgColorLabel'), el.bg, (v) => S().updateElement(el.id, { bg: v }))}
      <button
        className="btn btn-ghost wide"
        onClick={() => {
          S().pushHistory()
          S().deleteElement(el.id)
        }}
      >
        {t('resetEdit')}
      </button>
      <div className="hint">{t('editingTextHint')}</div>
    </>
  )
}

function TextBoxProps({ el, t, num, sizeRow, fontRow, colorRow }: RowProps & { el: TextBoxElement }) {
  const S = useDocStore.getState
  return (
    <>
      <label className="pblock">
        <span className="plabel">{t('textLabel')}</span>
        <textarea
          rows={4}
          value={el.text}
          onFocus={() => S().pushHistory()}
          onChange={(e) => S().updateElement(el.id, { text: e.target.value })}
        />
      </label>
      {sizeRow(el.fontSize, (n) => S().updateElement(el.id, { fontSize: n }))}
      {fontRow(el.font, (f) => S().updateElement(el.id, { font: f }))}
      {colorRow(t('colorLabel'), el.color, (v) => S().updateElement(el.id, { color: v }))}
      <div className="prow">
        <span>{t('alignLabel')}</span>
        <div className="align-btns">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              type="button"
              key={a}
              className={'chip' + (el.align === a ? ' on' : '')}
              onClick={() => {
                S().pushHistory()
                S().updateElement(el.id, { align: a })
              }}
            >
              {a === 'left' ? '⟵' : a === 'center' ? '⟷' : '⟶'}
            </button>
          ))}
        </div>
      </div>
      <label className="prow">
        <span>{t('widthLabel')}</span>
        <input
          type="number"
          min={20}
          value={Math.round(el.width)}
          onFocus={() => S().pushHistory()}
          onChange={(e) => S().updateElement(el.id, { width: Math.max(20, num(e.target.value, el.width)) })}
        />
      </label>
    </>
  )
}

function ShapeProps({ el, t, num, colorRow }: { el: ShapeElement; t: RowProps['t']; num: NumFn; colorRow: ColorRowFn }) {
  const S = useDocStore.getState
  return (
    <>
      {el.shape !== 'line' &&
        colorRow(t('fillLabel'), el.fill, (v) => S().updateElement(el.id, { fill: v }), {
          none: '',
          label: t('noFill'),
        })}
      {colorRow(t('strokeLabel'), el.stroke, (v) => S().updateElement(el.id, { stroke: v }))}
      <label className="prow">
        <span>{t('strokeWidthLabel')}</span>
        <input
          type="number"
          min={0.1}
          step={0.5}
          value={el.strokeWidth}
          onFocus={() => S().pushHistory()}
          onChange={(e) =>
            S().updateElement(el.id, { strokeWidth: Math.max(0.1, num(e.target.value, el.strokeWidth)) })
          }
        />
      </label>
      {el.shape !== 'line' && (
        <>
          <label className="prow">
            <span>{t('widthLabel')}</span>
            <input
              type="number"
              min={2}
              value={Math.round(el.w)}
              onFocus={() => S().pushHistory()}
              onChange={(e) => S().updateElement(el.id, { w: Math.max(2, num(e.target.value, el.w)) })}
            />
          </label>
          <label className="prow">
            <span>{t('heightLabel')}</span>
            <input
              type="number"
              min={2}
              value={Math.round(el.h)}
              onFocus={() => S().pushHistory()}
              onChange={(e) => S().updateElement(el.id, { h: Math.max(2, num(e.target.value, el.h)) })}
            />
          </label>
        </>
      )}
    </>
  )
}

function ImageProps({ el, t, num }: { el: ImageElement; t: RowProps['t']; num: NumFn }) {
  const S = useDocStore.getState
  return (
    <>
      <div className="pblock">
        <span className="plabel">{t('kindImage')}</span>
        <img className="props-img" src={el.dataUrl} alt="" />
      </div>
      <label className="prow">
        <span>{t('widthLabel')}</span>
        <input
          type="number"
          min={4}
          value={Math.round(el.w)}
          onFocus={() => S().pushHistory()}
          onChange={(e) => {
            const w = Math.max(4, num(e.target.value, el.w))
            S().updateElement(el.id, { w, h: (w / el.w) * el.h })
          }}
        />
      </label>
      <label className="prow">
        <span>{t('heightLabel')}</span>
        <input
          type="number"
          min={4}
          value={Math.round(el.h)}
          onFocus={() => S().pushHistory()}
          onChange={(e) => {
            const h = Math.max(4, num(e.target.value, el.h))
            S().updateElement(el.id, { h, w: (h / el.h) * el.w })
          }}
        />
      </label>
    </>
  )
}
