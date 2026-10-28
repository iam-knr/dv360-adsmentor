// Currency conversion (engine.md 8.7, RC-025): money is stored once in the advertiser currency as
// integer micros; the partner currency and USD are derived at read time from the fixed FX table.
import { roundHalfEven } from '../math';

export { convertMicros, fxToCurrency } from '../economics';

/** Amount in major units to integer micros with banker's rounding. */
export const toMicros = (amount: number): number => roundHalfEven(amount * 1_000_000);
export const fromMicros = (micros: number): number => micros / 1_000_000;
