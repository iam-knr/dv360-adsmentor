'use client';

// Results canvas of the instant builder (module 16 S2): flat table, pivot table and the four charts.
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as PieCell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { colors } from '@/lib/theme/tokens';
import type { Cell, QueryColumn, QueryResult, VizType } from '@/lib/reporting/types';

export function formatCell(v: Cell | undefined, type: string): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (type === 'INT') return Math.round(v).toLocaleString('en-US');
  if (type === 'PERCENT') return `${v.toFixed(2)}%`;
  if (type === 'MONEY' || type === 'DECIMAL')
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(v);
}

const SERIES = colors.chart;
const isNum = (c: QueryColumn) => c.kind === 'METRIC';

function FlatTable({ result }: { result: QueryResult }) {
  return (
    <TableContainer sx={{ maxHeight: 520 }}>
      <Table size="small" stickyHeader aria-label="Report results" data-testid="report-table">
        <TableHead>
          <TableRow>
            {result.columns.map((c) => (
              <TableCell key={c.key} align={isNum(c) ? 'right' : 'left'} sx={{ fontWeight: 500 }}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.rows.map((row, i) => (
            <TableRow key={i} hover>
              {result.columns.map((c, j) => (
                <TableCell key={c.key} align={isNum(c) ? 'right' : 'left'}>
                  {formatCell(row[j], c.dataType)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function PivotTable({ result, pivotKey }: { result: QueryResult; pivotKey: string }) {
  const pi = result.columns.findIndex((c) => c.key === pivotKey);
  if (pi < 0) return <FlatTable result={result} />;
  const dims = result.columns.map((c, i) => ({ c, i })).filter((x) => x.c.kind === 'DIMENSION' && x.i !== pi);
  const mets = result.columns.map((c, i) => ({ c, i })).filter((x) => x.c.kind === 'METRIC');
  const colValues = [...new Set(result.rows.map((r) => String(r[pi] ?? '')))];
  const groups = new Map<string, Map<string, Cell[]>>();
  for (const r of result.rows) {
    const key = JSON.stringify(dims.map((d) => r[d.i]));
    const g = groups.get(key) ?? new Map<string, Cell[]>();
    g.set(String(r[pi] ?? ''), mets.map((m) => r[m.i] ?? null));
    groups.set(key, g);
  }
  return (
    <TableContainer sx={{ maxHeight: 520 }}>
      <Table size="small" stickyHeader aria-label="Pivot results" data-testid="report-pivot">
        <TableHead>
          <TableRow>
            {dims.map((d) => (
              <TableCell key={d.c.key} rowSpan={2} sx={{ fontWeight: 500 }}>
                {d.c.label}
              </TableCell>
            ))}
            {colValues.map((v) => (
              <TableCell key={v} align="center" colSpan={mets.length} sx={{ fontWeight: 500 }}>
                {v || '(blank)'}
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            {colValues.flatMap((v) =>
              mets.map((m) => (
                <TableCell key={`${v}-${m.c.key}`} align="right">
                  {m.c.label}
                </TableCell>
              )),
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {[...groups.entries()].map(([key, g]) => {
            const dv = JSON.parse(key) as Cell[];
            return (
              <TableRow key={key} hover>
                {dv.map((x, i) => (
                  <TableCell key={i}>{String(x ?? '')}</TableCell>
                ))}
                {colValues.flatMap((v) =>
                  mets.map((m, mi) => (
                    <TableCell key={`${v}-${m.c.key}`} align="right">
                      {formatCell(g.get(v)?.[mi], m.c.dataType)}
                    </TableCell>
                  )),
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Chart({ result, viz }: { result: QueryResult; viz: VizType }) {
  const dimIdx = result.columns.findIndex((c) => c.kind === 'DIMENSION');
  const mets = result.columns.map((c, i) => ({ c, i })).filter((x) => x.c.kind === 'METRIC');
  const label = (r: Cell[]) =>
    result.columns
      .map((c, i) => (c.kind === 'DIMENSION' ? String(r[i] ?? '') : null))
      .filter((x): x is string => x !== null)
      .join(' / ');
  const data = result.rows.slice(0, 200).map((r) => {
    const o: Record<string, string | number | null> = { name: label(r) };
    for (const m of mets) o[m.c.key] = typeof r[m.i] === 'number' ? (r[m.i] as number) : null;
    return o;
  });
  const h = 360;
  if (viz === 'PIE') {
    const m = mets[0];
    if (!m) return null;
    return (
      <ResponsiveContainer width="100%" height={h}>
        <PieChart>
          <Pie data={data} dataKey={m.c.key} nameKey="name" outerRadius={130} label>
            {data.map((_, i) => (
              <PieCell key={i} fill={SERIES[i % SERIES.length] as string} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (viz === 'SCATTER') {
    const [a, b] = mets;
    if (!a || !b) return null;
    const pts = data.map((d) => ({ name: d.name, x: d[a.c.key], y: d[b.c.key] }));
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={a.c.label} />
          <YAxis type="number" dataKey="y" name={b.c.label} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={pts} fill={SERIES[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  void dimIdx;
  const Cmp = viz === 'TIME_SERIES' ? LineChart : BarChart;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <Cmp data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        {mets.map((m, i) =>
          viz === 'TIME_SERIES' ? (
            <Line key={m.c.key} dataKey={m.c.key} name={m.c.label} stroke={SERIES[i % SERIES.length] as string} dot={false} />
          ) : (
            <Bar key={m.c.key} dataKey={m.c.key} name={m.c.label} fill={SERIES[i % SERIES.length] as string} />
          ),
        )}
      </Cmp>
    </ResponsiveContainer>
  );
}

export function ReportCanvas({
  result,
  viz,
  pivotKey,
}: {
  result: QueryResult;
  viz: VizType;
  pivotKey?: string;
}) {
  const shown = result.rows.length;
  return (
    <Box data-testid="report-canvas">
      {viz === 'TABLE' ? <FlatTable result={result} /> : null}
      {viz === 'PIVOT_TABLE' ? <PivotTable result={result} pivotKey={pivotKey ?? ''} /> : null}
      {viz !== 'TABLE' && viz !== 'PIVOT_TABLE' ? <Chart result={result} viz={viz} /> : null}
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary" data-testid="report-footer">
          {result.truncated || result.totalRows > shown
            ? `Showing first ${shown.toLocaleString('en-US')} of ${result.totalRows.toLocaleString('en-US')} rows. Download for the full file.`
            : `${shown.toLocaleString('en-US')} ${shown === 1 ? 'row' : 'rows'}`}
        </Typography>
        {result.warnings.includes('APPROXIMATED_PIVOT') ? (
          <Typography variant="caption" color="text.secondary">
            Approximated pivot: the second dimension is split in proportion to the first.
          </Typography>
        ) : null}
        {result.warnings.includes('TIME_ZONE_APPROXIMATED') ? (
          <Typography variant="caption" color="text.secondary">
            UTC totals are shifted from whole days and are approximate.
          </Typography>
        ) : null}
        {result.warnings.includes('LATE_CONVERSIONS') ? (
          <Typography variant="caption" color="text.secondary">
            Data freshness: conversions for the last 30 days may still be updated.
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
