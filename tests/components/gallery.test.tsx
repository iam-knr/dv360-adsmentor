import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { GALLERY_ENTRIES, GalleryEntryFrame } from '@/app/(dev)/components/entries';
import { renderDv } from './test-utils';

describe('component gallery', () => {
  it('has an entry for every Tier A and Tier B group', () => {
    const ids = GALLERY_ENTRIES.map((e) => e.id);
    for (const id of [
      'shell',
      'rail',
      'grid',
      'bulk-bar',
      'filter-bar',
      'date-range',
      'forms',
      'form-footer',
      'status',
      'modals',
      'slide-over',
      'feedback',
      'empty',
      'loading',
      'navigation',
      'headers',
      'charts',
      'pickers',
    ]) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(GALLERY_ENTRIES)('$title', ({ id, title, Demo }) => {
    it('renders with no axe violations', async () => {
      const { container } = renderDv(
        <main>
          <h1>Gallery</h1>
          <GalleryEntryFrame id={id} title={title}>
            <Demo />
          </GalleryEntryFrame>
        </main>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
