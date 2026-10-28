// @vitest-environment jsdom
// useValidatedForm and useUnsavedChanges (validation.md 5.1, 6.6).
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResolver, useValidatedForm } from '@/lib/validation/client/useValidatedForm';
import { useUnsavedChanges } from '@/lib/validation/client/useUnsavedChanges';
import { focusFirstInvalid } from '@/lib/validation/client/issues';
import { makeCtx, validCampaign } from '@/lib/validation/testing/fixtures';
import { validate } from '@/lib/validation';
import type { CampaignInput } from '@/lib/validation/types';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('createResolver', () => {
  const options = { fields: {}, shouldUseNativeValidation: false } as never;

  it('passes a valid form through', async () => {
    const result = await createResolver<CampaignInput>('campaign', makeCtx())(
      validCampaign(),
      undefined,
      options,
    );
    expect(result.errors).toEqual({});
  });

  it('nests the errors by path', async () => {
    const values = { ...validCampaign(), name: '', budgets: [{ name: 'Q4', amount: null }] };
    const result = await createResolver<CampaignInput>('campaign', makeCtx())(
      values,
      undefined,
      options,
    );
    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      name: { type: 'CMP-001', message: 'Enter a value' },
      budgets: [{ amount: { type: 'CMP-050' } }],
    });
  });

  it('does not turn warnings into errors', async () => {
    const values = { ...validCampaign(), kpi: { type: 'CPA' as const, value: 5 } };
    const result = await createResolver<CampaignInput>('campaign', makeCtx())(
      values,
      undefined,
      options,
    );
    expect(result.errors).toEqual({});
  });
});

describe('useValidatedForm', () => {
  const setup = () => {
    const ctx = makeCtx();
    return renderHook(() =>
      useValidatedForm<CampaignInput>({ kind: 'campaign', ctx, defaultValues: validCampaign() }),
    );
  };

  it('checkAll shows the errors and reports failure', () => {
    const { result } = setup();
    act(() => {
      result.current.form.setValue('name', '');
    });
    let ok = true;
    act(() => {
      ok = result.current.checkAll();
    });
    expect(ok).toBe(false);
    expect(result.current.form.getFieldState('name').error?.message).toBe('Enter a value');
  });

  it('checkAll is true for a valid form', () => {
    const { result } = setup();
    let ok = false;
    act(() => {
      ok = result.current.checkAll();
    });
    expect(ok).toBe(true);
  });

  it('validateField runs the blur subset and clears the error when fixed', () => {
    const { result } = setup();
    act(() => {
      result.current.form.setValue('name', '');
      result.current.validateField('name');
    });
    expect(result.current.form.getFieldState('name').error?.type).toBe('CMP-001');
    act(() => {
      result.current.form.setValue('name', 'Fixed');
      result.current.validateField('name');
    });
    expect(result.current.form.getFieldState('name').error).toBeUndefined();
  });

  it('keeps warnings in softIssues', () => {
    const { result } = setup();
    act(() => {
      result.current.form.setValue('kpi', { type: 'CPA', value: 5 });
    });
    expect(result.current.softIssues.map((i) => i.ruleId)).toContain('CMP-013');
    expect(result.current.form.getFieldState('kpi.type').error).toBeUndefined();
  });
});

describe('focusFirstInvalid', () => {
  it('focuses the field named by the first error', () => {
    document.body.innerHTML = '<input name="name" /><input name="goal" />';
    const issues = validate('campaign', { ...validCampaign(), name: '' }, makeCtx());
    expect(focusFirstInvalid(issues)).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('[name="name"]'));
  });

  it('does nothing when there is no error or no field', () => {
    expect(focusFirstInvalid(validate('campaign', validCampaign(), makeCtx()))).toBe(false);
    document.body.innerHTML = '';
    expect(
      focusFirstInvalid(validate('campaign', { ...validCampaign(), name: '' }, makeCtx())),
    ).toBe(false);
  });
});

describe('useUnsavedChanges', () => {
  const clean = { name: 'a' };
  const dirty = { name: 'b' };

  it('reports the dirty state', () => {
    expect(
      renderHook(() => useUnsavedChanges({ current: clean, initial: clean })).result.current
        .isDirty,
    ).toBe(false);
    expect(
      renderHook(() => useUnsavedChanges({ current: dirty, initial: clean })).result.current
        .isDirty,
    ).toBe(true);
  });

  it('asks the browser before the tab closes, only when dirty (UC-2)', () => {
    renderHook(() => useUnsavedChanges({ current: dirty, initial: clean }));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    cleanup();
    renderHook(() => useUnsavedChanges({ current: clean, initial: clean }));
    const calm = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(calm);
    expect(calm.defaultPrevented).toBe(false);
  });

  it('opens DLG-01 on a link click and navigates only after Discard (UC-1)', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChanges({ current: dirty, initial: clean, navigate }),
    );
    document.body.innerHTML = '<a id="link" href="/somewhere">Leave</a>';
    const link = document.getElementById('link')!;
    act(() => {
      link.click();
    });
    expect(result.current.dialogOpen).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    act(() => {
      result.current.discard();
    });
    expect(result.current.dialogOpen).toBe(false);
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/somewhere'));
  });

  it('Continue editing closes the dialog and leaves the form alone', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChanges({ current: dirty, initial: clean, navigate }),
    );
    document.body.innerHTML = '<a id="link" href="/somewhere">Leave</a>';
    act(() => {
      document.getElementById('link')!.click();
    });
    act(() => {
      result.current.continueEditing();
    });
    expect(result.current.dialogOpen).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.isDirty).toBe(true);
  });

  it('ignores links that open elsewhere or stay on the page', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChanges({ current: dirty, initial: clean, navigate }),
    );
    document.body.innerHTML =
      '<a id="a" href="https://other.example/x">x</a><a id="b" href="/x" target="_blank">y</a><a id="c" href="#top">z</a>';
    for (const id of ['a', 'b', 'c']) {
      act(() => {
        document
          .getElementById(id)!
          .addEventListener('click', (e) => e.preventDefault(), { once: true });
        document.getElementById(id)!.click();
      });
    }
    expect(result.current.dialogOpen).toBe(false);
  });

  it('requestLeave runs at once when clean and waits for Discard when dirty', () => {
    const leave = vi.fn();
    const cleanHook = renderHook(() => useUnsavedChanges({ current: clean, initial: clean }));
    cleanHook.result.current.requestLeave(leave);
    expect(leave).toHaveBeenCalledTimes(1);

    const later = vi.fn();
    const dirtyHook = renderHook(() => useUnsavedChanges({ current: dirty, initial: clean }));
    act(() => {
      dirtyHook.result.current.requestLeave(later);
    });
    expect(later).not.toHaveBeenCalled();
    expect(dirtyHook.result.current.dialogOpen).toBe(true);
    act(() => {
      dirtyHook.result.current.discard();
    });
    expect(later).toHaveBeenCalledTimes(1);
  });
});
