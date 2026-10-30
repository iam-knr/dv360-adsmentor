'use client';

import { useRouter, usePathname } from 'next/navigation';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

/** Class selector in the console header when the person teaches several classes (module 18 I1). */
export function ClassPicker({
  classes,
  value,
}: {
  classes: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (classes.length < 2) return null;
  return (
    <TextField
      select
      size="small"
      label="Class"
      value={value}
      onChange={(e) => router.push(`${pathname}?class=${encodeURIComponent(e.target.value)}`)}
      sx={{ minWidth: 220 }}
    >
      {classes.map((c) => (
        <MenuItem key={c.id} value={c.id}>
          {c.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
