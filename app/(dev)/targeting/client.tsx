'use client';

import { useState } from 'react';
import { TargetingCard } from '@/components/targeting';
import { emptyTargetingState, LI_TYPES_FOR_DEV } from '@/lib/targeting/dev';

export function TargetingDevClient() {
  const [type, setType] = useState('DISPLAY');
  const [readOnly, setReadOnly] = useState(false);
  const [state, setState] = useState(() => emptyTargetingState('DISPLAY'));
  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <label>
        Line item type{' '}
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setState(emptyTargetingState(e.target.value));
          }}
        >
          {LI_TYPES_FOR_DEV.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label style={{ marginLeft: 16 }}>
        <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />{' '}
        Read-only role
      </label>
      <TargetingCard lineItemType={type} value={state} onChange={setState} readOnly={readOnly} />
    </main>
  );
}
