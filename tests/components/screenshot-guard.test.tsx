import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenshotGuard, reportScreenshot } from '@/components/security/ScreenshotGuard';

function setup() {
  const report = vi.fn();
  const navigate = vi.fn();
  const view = render(<ScreenshotGuard report={report} navigate={navigate} />);
  return { report, navigate, ...view };
}

describe('ScreenshotGuard', () => {
  it('reports PrintScreen and leaves for the suspended page', () => {
    const { report, navigate } = setup();
    fireEvent.keyDown(window, { key: 'PrintScreen', code: 'PrintScreen' });
    expect(report).toHaveBeenCalledWith('PRINT_SCREEN', window.location.pathname);
    expect(navigate).toHaveBeenCalledWith('/sim/suspended');
  });

  it('handles a key up only PrintScreen', () => {
    const { report, navigate } = setup();
    fireEvent.keyUp(window, { key: 'PrintScreen', code: 'PrintScreen' });
    expect(report).toHaveBeenCalledWith('PRINT_SCREEN', expect.any(String));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('reports once for key down and key up of one press', () => {
    const { report, navigate } = setup();
    fireEvent.keyDown(window, { key: 'PrintScreen', code: 'PrintScreen' });
    fireEvent.keyUp(window, { key: 'PrintScreen', code: 'PrintScreen' });
    expect(report).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Win+Shift+S', { key: 'S', code: 'KeyS', metaKey: true, shiftKey: true }, 'WIN_SHIFT_S'],
    ['Cmd+Shift+4', { key: '$', code: 'Digit4', metaKey: true, shiftKey: true }, 'MAC_SHORTCUT'],
    ['Ctrl+P', { key: 'p', code: 'KeyP', ctrlKey: true }, 'PRINT_SHORTCUT'],
    ['Ctrl+Shift+S', { key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true }, 'BROWSER_CAPTURE'],
  ])('reports %s', (_n, init, method) => {
    const { report } = setup();
    fireEvent.keyDown(window, init);
    expect(report).toHaveBeenCalledWith(method, expect.any(String));
  });

  it('reports Win/Cmd+Shift followed by the window losing focus (the OS keeps the last key)', () => {
    const { report, navigate } = setup();
    fireEvent.keyDown(window, { key: 'Meta', code: 'MetaLeft', metaKey: true });
    fireEvent.keyDown(window, { key: 'Shift', code: 'ShiftLeft', metaKey: true, shiftKey: true });
    window.dispatchEvent(new Event('blur'));
    expect(report).toHaveBeenCalledWith('SNIP_CHORD', expect.any(String));
    expect(navigate).toHaveBeenCalledWith('/sim/suspended');
  });

  it('does not report a plain blur (switching tabs or windows)', () => {
    const { report, navigate } = setup();
    window.dispatchEvent(new Event('blur'));
    expect(report).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports the print event', () => {
    const { report, navigate } = setup();
    window.dispatchEvent(new Event('beforeprint'));
    expect(report).toHaveBeenCalledWith('PRINT_EVENT', expect.any(String));
    expect(navigate).toHaveBeenCalledWith('/sim/suspended');
  });

  it('does nothing while typing, also inside an input', () => {
    const { report, navigate, container } = setup();
    const input = document.createElement('input');
    container.appendChild(input);
    for (const init of [
      { key: 's', code: 'KeyS' },
      { key: 'S', code: 'KeyS', shiftKey: true },
      { key: '3', code: 'Digit3' },
      { key: '#', code: 'Digit3', shiftKey: true },
      { key: 'p', code: 'KeyP' },
    ]) {
      fireEvent.keyDown(input, init);
      fireEvent.keyUp(input, init);
    }
    expect(report).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('blanks printed output', () => {
    const { container } = setup();
    const style = container.querySelector('style[media="print"]');
    expect(style?.textContent).toContain('display: none');
  });

  it('stops listening when it is removed', () => {
    const { report, unmount } = setup();
    unmount();
    fireEvent.keyDown(window, { key: 'PrintScreen', code: 'PrintScreen' });
    expect(report).not.toHaveBeenCalled();
  });
});

describe('reportScreenshot', () => {
  it('uses sendBeacon with a JSON body (method and path only)', async () => {
    const beacon = vi.fn(() => true);
    const fetcher = vi.fn();
    reportScreenshot('PRINT_SCREEN', '/p/1', { beacon, fetcher });
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe('/api/security/screenshot-event');
    const text = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsText(blob);
    });
    expect(JSON.parse(text)).toEqual({ method: 'PRINT_SCREEN', path: '/p/1' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('falls back to fetch with keepalive when the beacon is refused', () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response('{}')));
    reportScreenshot('PRINT_EVENT', '/x', { beacon: () => false, fetcher });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/security/screenshot-event',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
  });
});
