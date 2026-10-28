'use client';

// react-hook-form resolver and blur subset (validation.md 6.6). Warnings and infos go to `softIssues`.
import { useCallback, useMemo } from 'react';
import {
  type DefaultValues,
  type FieldErrors,
  type FieldValues,
  type Resolver,
  set,
  useForm,
  type UseFormReturn,
} from 'react-hook-form';
import { validate } from '../engine';
import type { EntityKind, Issue, ValidateOptions, ValidationContext } from '../types';
import { focusFirstInvalid, softIssuesOf, toFieldErrors } from './issues';

export interface UseValidatedFormOptions<T extends FieldValues> {
  kind: EntityKind;
  ctx: ValidationContext;
  defaultValues: DefaultValues<T>;
  /** 'ACTIVE' adds the activation rules (IO-091, LI-063, ...). */
  targetStatus?: ValidateOptions['targetStatus'];
}

/** A react-hook-form resolver that runs the save subset of the rules and nests the errors by path. */
export function createResolver<T extends FieldValues>(
  kind: EntityKind,
  ctx: ValidationContext,
  targetStatus?: ValidateOptions['targetStatus'],
): Resolver<T> {
  return (values) => {
    const issues = validate(kind, values, ctx, {
      trigger: 'save',
      ...(targetStatus ? { targetStatus } : {}),
    });
    const flat = toFieldErrors(issues);
    const errors: Record<string, unknown> = {};
    for (const [path, error] of Object.entries(flat)) set(errors, path, error);
    return Object.keys(flat).length === 0
      ? { values, errors: {} }
      : { values: {}, errors: errors as FieldErrors<T> };
  };
}

export interface UseValidatedForm<T extends FieldValues> {
  form: UseFormReturn<T>;
  /** Warnings and infos for the current values. */
  softIssues: Issue[];
  /** Run the blur subset for one field and show its errors. Call from onBlur. */
  validateField: (path: string) => Issue[];
  /** Run the save rules, show the errors and focus the first invalid field. Returns true when none block. */
  checkAll: () => boolean;
}

export function useValidatedForm<T extends FieldValues>(options: UseValidatedFormOptions<T>): UseValidatedForm<T> {
  const { kind, ctx, defaultValues, targetStatus } = options;
  const resolver = useMemo(() => createResolver<T>(kind, ctx, targetStatus), [kind, ctx, targetStatus]);
  const form = useForm<T>({ defaultValues, resolver, mode: 'onSubmit', reValidateMode: 'onBlur' });

  const values = form.watch();
  const softIssues = useMemo(
    () => softIssuesOf(validate(kind, values, ctx, { trigger: 'save', ...(targetStatus ? { targetStatus } : {}) })),
    [kind, values, ctx, targetStatus],
  );

  const validateField = useCallback(
    (path: string): Issue[] => {
      const issues = validate(kind, form.getValues(), ctx, { trigger: 'blur', changedPath: path });
      const errors = toFieldErrors(issues);
      for (const [errorPath, error] of Object.entries(errors)) {
        form.setError(errorPath as never, { type: error.type, message: error.message });
      }
      if (!(path in errors)) form.clearErrors(path as never);
      return issues;
    },
    [kind, ctx, form],
  );

  const checkAll = useCallback((): boolean => {
    const issues = validate(kind, form.getValues(), ctx, {
      trigger: 'save',
      ...(targetStatus ? { targetStatus } : {}),
    });
    const errors = toFieldErrors(issues);
    for (const [path, error] of Object.entries(errors)) {
      form.setError(path as never, { type: error.type, message: error.message });
    }
    if (Object.keys(errors).length > 0) focusFirstInvalid(issues);
    return Object.keys(errors).length === 0;
  }, [kind, ctx, form, targetStatus]);

  return { form, softIssues, validateField, checkAll };
}
