'use client';

// Negative keyword list inline editor (module 15 S2, `?list={id}`): name, keywords textarea with counter, the line
// items table, Save / Cancel / Delete. KW-002 is shown with the NEG_KW_LIMIT help text.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvModal, DvSectionCard, DvTextField } from '@/components/dv';
import {
  createKeywordListAction,
  deleteKeywordListAction,
  getKeywordListAction,
  updateKeywordListAction,
} from '@/lib/resources/actions';
import { parseKeywords } from '@/lib/resources/keywords';
import { RESOURCE_LIMITS } from '@/lib/resources/limits';
import type { KeywordListView, WireIssue } from '@/lib/resources/wire';

export interface KeywordListEditorProps {
  listId: string;
  advertiserId: string;
  readOnly: boolean;
  onClose: () => void;
}

const HELP =
  'Enter or paste keywords to exclude, one per line or separated by commas. Your list can contain up to 5,000 keywords.';

export function KeywordListEditor({
  listId,
  advertiserId,
  readOnly,
  onClose,
}: KeywordListEditorProps) {
  const router = useRouter();
  const creating = listId === 'new';
  const [loaded, setLoaded] = useState<KeywordListView | null>(null);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (creating) return;
    let alive = true;
    void getKeywordListAction(listId).then((v) => {
      if (!alive || !v) return;
      setLoaded(v);
      setName(v.name);
      setKeywords(v.keywords);
    });
    return () => {
      alive = false;
    };
  }, [listId, creating]);

  const parsed = useMemo(() => parseKeywords(keywords), [keywords]);
  const err = (p: string) => issues.find((i) => i.severity === 'error' && i.path === p)?.message;
  const kwError = issues.find(
    (i) => i.severity === 'error' && i.path.startsWith('keywords'),
  )?.message;
  const dirty = creating
    ? name !== '' || keywords !== ''
    : loaded !== null && (name !== loaded.name || keywords !== loaded.keywords);

  const save = () =>
    start(async () => {
      const res = creating
        ? await createKeywordListAction(advertiserId, { name, keywords })
        : await updateKeywordListAction(
            listId,
            { name, keywords },
            { expectedVersion: loaded!.version },
          );
      if (!res.ok) return setIssues(res.issues);
      onClose();
      router.refresh();
    });

  const remove = (confirmed: boolean) =>
    start(async () => {
      const res = await deleteKeywordListAction(listId, confirmed);
      if (!res.ok) return setIssues(res.issues);
      if (!res.data.deleted) return setConfirmDelete(res.data.usedBy);
      onClose();
      router.refresh();
    });

  return (
    <DvSectionCard
      title={creating ? 'New negative keyword list' : (loaded?.name ?? 'Negative keyword list')}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DvTextField
          label="Name"
          required
          value={name}
          readOnly={readOnly}
          error={err('name')}
          onChange={setName}
          id="keyword-list-name"
        />
        <DvTextField
          label="Keywords"
          multiline
          rows={10}
          value={keywords}
          readOnly={readOnly}
          error={kwError}
          hint={`${HELP} ${parsed.keywords.length.toLocaleString('en-US')} / ${RESOURCE_LIMITS.KEYWORDS_MAX.toLocaleString('en-US')}`}
          onChange={setKeywords}
          id="keyword-list-keywords"
        />
        {!creating ? (
          <Box
            component="table"
            aria-label="Line items"
            sx={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">ID</th>
              </tr>
            </thead>
            <tbody>
              {(loaded?.lineItems ?? []).map((li) => (
                <tr key={li.publicId}>
                  <td>{li.name}</td>
                  <td>{li.publicId}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        ) : null}
        <Box sx={{ display: 'flex', gap: 2 }}>
          {readOnly ? null : (
            <Button variant="contained" onClick={save} disabled={!dirty}>
              Save
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Box sx={{ flex: 1 }} />
          {!creating && !readOnly ? (
            <Button color="error" onClick={() => remove(false)}>
              Delete
            </Button>
          ) : null}
        </Box>
        {parsed.duplicates > 0 ? (
          <Typography variant="caption">{parsed.duplicates} duplicates will be removed.</Typography>
        ) : null}
      </Box>
      <DvModal
        open={confirmDelete !== null}
        title="Delete list"
        primary={{ label: 'Delete', tone: 'danger', onClick: () => remove(true) }}
        secondary={{ label: 'Cancel', onClick: () => setConfirmDelete(null) }}
        onClose={() => setConfirmDelete(null)}
      >
        {confirmDelete} line items use this list. Deleting it removes it from their targeting.
      </DvModal>
    </DvSectionCard>
  );
}
