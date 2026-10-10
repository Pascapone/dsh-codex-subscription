import type { RefObject } from 'react';
import type { SketchDocument, SketchLayer } from './sketch-types.js';
import type { Translate } from './client-types.js';
import type { createSketchDocumentLifecycle } from './sketch-document-lifecycle.js';
export function SketchPicturePanel({
  document,
  disabled,
  pictureInput,
  importImage,
  runFile,
  change,
  t
}: { document: SketchDocument; disabled: boolean; pictureInput: RefObject<HTMLInputElement>; importImage: ReturnType<typeof createSketchDocumentLifecycle>['importImage']; runFile(work: () => unknown | Promise<unknown>): unknown; change(action: string, id: number): unknown; t: Translate }) {
  const pictures = document.layers.filter((layer): layer is SketchLayer & { image: NonNullable<SketchLayer['image']> } => !!layer.image)

  return (
    <aside className="codexSketchPictures">
      <header>
        <strong>{t('sketchPictures')}</strong>
        <button
          type="button"
          disabled={disabled}
          onClick={() => pictureInput.current?.click()}
        >
          {t('sketchPictureAdd')}
        </button>
      </header>
      <input
        ref={pictureInput}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void runFile(() => importImage(file))
        }}
      />
      {pictures.map((layer) => (
        <div key={layer.id} data-active={layer.id === document.active}>
          <button
            type="button"
            disabled={disabled}
            aria-label={`${t('sketchPictureSelect')} ${layer.name}`}
            onClick={() => change('select', layer.id)}
          >
            <img src={layer.image.src} alt={layer.name} />
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label={`${t('sketchDeleteDraft')} ${layer.name}`}
            onClick={() =>
              change(document.layers.length === 1 ? 'clear' : 'delete', layer.id)
            }
          >
            ×
          </button>
        </div>
      ))}
      {pictures.length === 0 ? <small>{t('sketchPicturesEmpty')}</small> : null}
    </aside>
  )
}
