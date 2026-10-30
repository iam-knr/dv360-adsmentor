import 'server-only';
import { notFound } from 'next/navigation';
import { InstructorError } from './rules';

/** Pages: an unknown class, or one the person does not teach, is the 404 page (SIM-020). */
export async function orNotFound<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof InstructorError && err.code === 'SIM-020') notFound();
    throw err;
  }
}
