import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CaptureLab, describeKey, reportText, type LabEntry } from '@/components/manage/CaptureLab';
import { renderDv } from './test-utils';

describe('CaptureLab', () => {
  it('shows an empty state and nothing tripped at first', () => {
    renderDv(<CaptureLab />);
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.getByTestId('lab-summary')).toHaveTextContent('Guard has not tripped yet');
  });

  it('logs the events the browser delivers and marks the one the guard would trip on', () => {
    renderDv(<CaptureLab />);
    fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    fireEvent.keyDown(window, { key: 'PrintScreen', code: 'PrintScreen' });
    const rows = screen.getAllByTestId('lab-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-verdict', '');
    expect(rows[1]).toHaveAttribute('data-verdict', 'PRINT_SCREEN');
    expect(screen.getByTestId('lab-summary')).toHaveTextContent('Print Screen key');
  });

  it('shows the chord plus blur rule: Meta+Shift held, then the window loses focus', () => {
    renderDv(<CaptureLab />);
    fireEvent.keyDown(window, { key: 'Meta', code: 'MetaLeft', metaKey: true });
    fireEvent.keyDown(window, { key: 'Shift', code: 'ShiftLeft', metaKey: true, shiftKey: true });
    fireEvent.blur(window);
    const rows = screen.getAllByTestId('lab-row');
    expect(rows.at(-1)).toHaveAttribute('data-verdict', 'SNIP_CHORD');
    expect(screen.getByTestId('lab-summary')).toHaveTextContent('Snipping or screenshot shortcut');
  });

  it('clears the log', () => {
    renderDv(<CaptureLab />);
    fireEvent.keyDown(window, { key: 'x', code: 'KeyX' });
    expect(screen.getAllByTestId('lab-row')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear log' }));
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  });

  it('formats key details and the copyable report', () => {
    expect(
      describeKey({ key: 'S', code: 'KeyS', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false }),
    ).toBe('key="S" code=KeyS modifiers=Ctrl+Shift');
    const entries: LabEntry[] = [
      { id: 1, at: 0, type: 'keydown', detail: 'key="a" code=KeyA modifiers=none', verdict: null },
      { id: 2, at: 120, type: 'blur', detail: 'window lost focus', verdict: 'SNIP_CHORD' },
    ];
    const text = reportText(entries, 'Win32 | test');
    expect(text.split('\n')).toHaveLength(4);
    expect(text).toContain('GUARD WOULD TRIP: SNIP_CHORD');
  });
});
