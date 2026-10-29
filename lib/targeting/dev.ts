// Dev page helpers (app/(dev)/targeting). Re-exports keep the client file free of deep imports.
import { LI_TYPES } from '@/lib/validation/constants/li-compat';

export { emptyTargetingState } from './dimensions';
export const LI_TYPES_FOR_DEV: readonly string[] = LI_TYPES;
