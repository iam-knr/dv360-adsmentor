'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import { checkEmail, checkName, checkNotes } from '@/lib/accounts/rules';
import { createAccountAction, generateAccountPassword } from '@/lib/actions/accounts';
import { passwordStrength } from '@/lib/auth/password-policy';
import { OneTimeSecret } from './OneTimeSecret';

export interface AddAccountFormProps {
  isSuper: boolean;
  cohorts: { id: string; name: string; used: number; capacity: number }[];
  signInUrl: string;
}

export function AddAccountForm({ isSuper, cohorts, signInUrl }: AddAccountFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN' | 'SUPER_ADMIN'>('USER');
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? '');
  const [mode, setMode] = useState<'GENERATE' | 'SET'>('GENERATE');
  const [typed, setTyped] = useState('');
  const [generated, setGenerated] = useState('');
  const [show, setShow] = useState(false);
  const [mustChange, setMustChange] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ email: string; password?: string } | null>(null);

  const strength = passwordStrength(mode === 'SET' ? typed : generated, { email });
  const needsCohort = role === 'USER';

  const submit = () => {
    const normalised = email.trim().toLowerCase();
    const e: Record<string, string> = {};
    const eEmail = checkEmail(normalised);
    const eName = checkName(name);
    const eNotes = checkNotes(notes);
    if (eEmail) e.email = eEmail;
    if (eName) e.name = eName;
    if (eNotes) e.notes = eNotes;
    if (needsCohort && !cohortId) e.cohort = 'Choose a cohort.';
    setErrors(e);
    setError(undefined);
    if (Object.keys(e).length) return;
    start(async () => {
      const res = await createAccountAction({
        email: normalised,
        name,
        role,
        cohortId: needsCohort ? cohortId : undefined,
        notes: notes || undefined,
        mustChangePassword: mustChange,
        // a generated value is made on the server at create time, so the plaintext is never posted back
        password: mode === 'SET' ? { mode: 'SET', value: typed } : { mode: 'GENERATE' },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTyped('');
      setCreated({ email: res.data.email, password: res.data.initialPassword });
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 720 }}>
      <Typography variant="pageTitle" component="h1">
        Add account
      </Typography>
      {error ? (
        <div role="alert">
          <DvBanner kind="error">{error}</DvBanner>
        </div>
      ) : null}
      <DvSectionCard title="Who">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <DvTextField
            label="Email"
            name="email"
            type="email"
            required
            value={email}
            onChange={setEmail}
            onBlur={() => setEmail((v) => v.trim().toLowerCase())}
            error={errors.email}
          />
          <DvTextField
            label="Display name"
            name="name"
            required
            value={name}
            onChange={setName}
            error={errors.name}
          />
          <DvSelect
            label="Role"
            required
            value={role}
            onChange={(v) => setRole(v as typeof role)}
            disabled={!isSuper}
            help={isSuper ? undefined : 'Admins can add users only.'}
            options={
              isSuper
                ? [
                    { value: 'SUPER_ADMIN', label: 'Super admin' },
                    { value: 'ADMIN', label: 'Admin' },
                    { value: 'USER', label: 'User' },
                  ]
                : [{ value: 'USER', label: 'User' }]
            }
          />
        </Box>
      </DvSectionCard>
      {needsCohort ? (
        <DvSectionCard title="Where">
          {cohorts.length ? (
            <DvSelect
              label="Cohort"
              required
              value={cohortId}
              onChange={setCohortId}
              error={errors.cohort}
              options={cohorts.map((c) => ({
                value: c.id,
                label: c.name,
                secondLine: `${c.used} of ${c.capacity} used`,
                disabled: c.used >= c.capacity,
              }))}
            />
          ) : (
            <Typography>
              No cohorts yet. <Link href="/manage/cohorts/new">Create a cohort</Link> first.
            </Typography>
          )}
        </DvSectionCard>
      ) : null}
      <DvSectionCard title="Password">
        <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <FormControlLabel
            value="GENERATE"
            control={<Radio />}
            label="Generate a strong password"
          />
          <FormControlLabel value="SET" control={<Radio />} label="I will set a password" />
        </RadioGroup>
        {mode === 'GENERATE' ? (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              A strong password is generated when you create the account and shown once.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() =>
                start(async () => {
                  const r = await generateAccountPassword();
                  if (r.ok) setGenerated(r.data.value);
                })
              }
            >
              Preview strength
            </Button>
            {generated ? <Typography variant="caption">Strong</Typography> : null}
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            <DvTextField
              label="Password"
              name="password"
              type={show ? 'text' : 'password'}
              value={typed}
              onChange={setTyped}
              hint="At least 10 characters, with 3 of: lowercase, uppercase, number, symbol."
            />
            <Button size="small" onClick={() => setShow((s) => !s)}>
              {show ? 'Hide' : 'Show'}
            </Button>
            {typed ? (
              <Typography variant="caption" aria-live="polite">
                {' '}
                Strength: {strength}
              </Typography>
            ) : null}
          </Box>
        )}
        <FormControlLabel
          control={
            <Checkbox checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
          }
          label="Ask for a new password at first sign in"
        />
        {!mustChange ? (
          <Typography variant="caption">Anyone who knows this password can sign in.</Typography>
        ) : null}
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
          Adsmetor does not send email. Share the email and password with the person yourself.
        </Typography>
      </DvSectionCard>
      <DvSectionCard title="Notes">
        <DvTextField
          label="Notes (optional)"
          multiline
          rows={3}
          maxLength={500}
          value={notes}
          onChange={setNotes}
          error={errors.notes}
        />
      </DvSectionCard>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={() => router.push('/manage/accounts')}>Cancel</Button>
        <Button
          variant="contained"
          disabled={pending || (needsCohort && !cohortId)}
          onClick={submit}
        >
          Create account
        </Button>
      </Box>
      {created ? (
        <OneTimeSecret
          title="Account created"
          rows={[created]}
          signInUrl={signInUrl}
          onDone={() => {
            setCreated(null);
            router.push('/manage/accounts');
            router.refresh();
          }}
        />
      ) : null}
    </Box>
  );
}
