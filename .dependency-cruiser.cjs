/** Layering rules: build-plan 2.4 and engine.md 1.5. */
const ENGINE_MODULES = [
  'params',
  'rng',
  'clock',
  'supply',
  'eligibility',
  'bidding',
  'auction',
  'outcomes',
  'pacing',
  'costs',
  'diagnostics',
  'aggregation',
  'scenario',
];
// Allowed imports between engine modules (engine.md 1.5). Anything else fails.
const ENGINE_ALLOWED = {
  params: [],
  rng: [],
  clock: ['params'],
  supply: ['params', 'rng'],
  eligibility: ['supply', 'params'],
  bidding: ['eligibility', 'supply', 'params'],
  auction: ['bidding', 'supply', 'params', 'rng'],
  outcomes: ['auction', 'params', 'rng'],
  pacing: ['params'],
  costs: ['auction', 'outcomes', 'params'],
  diagnostics: ['eligibility', 'auction', 'pacing', 'params'],
  aggregation: [
    'eligibility',
    'bidding',
    'auction',
    'outcomes',
    'pacing',
    'costs',
    'diagnostics',
    'supply',
    'params',
    'rng',
  ],
  scenario: ['params'],
};

const engineRules = ENGINE_MODULES.map((mod) => {
  const allowed = [mod, ...ENGINE_ALLOWED[mod]];
  const forbidden = ENGINE_MODULES.filter((m) => !allowed.includes(m));
  return {
    name: `engine-${mod}-direction`,
    comment: `lib/engine/${mod} may only import: ${allowed.join(', ')}`,
    severity: 'error',
    from: { path: `^lib/engine/${mod}/` },
    to: { path: `^lib/engine/(${forbidden.join('|')})/`, pathNot: '^lib/engine/(params|rng)/' },
  };
});

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'components-no-db',
      comment: 'Components never import lib/db or Prisma (build-plan 2.9)',
      severity: 'error',
      from: { path: '^components/' },
      to: { path: ['^lib/db/', '^node_modules/@prisma/client', '^node_modules/\\.prisma/'] },
    },
    {
      name: 'lib-no-ui',
      comment: 'lib/** may not import components/** or app/**',
      severity: 'error',
      from: { path: '^lib/' },
      to: { path: ['^components/', '^app/'] },
    },
    {
      name: 'engine-io-isolated',
      comment:
        'lib/engine/io/** is imported only by app/api/**, lib/engine/server.ts, scripts/** and itself',
      severity: 'error',
      from: {
        pathNot: [
          '^app/api/',
          '^lib/engine/server\\.ts$',
          '^scripts/',
          '^lib/engine/io/',
          '^tests/',
        ],
      },
      to: { path: '^lib/engine/io/' },
    },
    {
      name: 'engine-io-only-prisma',
      comment: 'Only lib/engine/io may import Prisma inside lib/engine',
      severity: 'error',
      from: { path: '^lib/engine/', pathNot: ['^lib/engine/io/', '^lib/engine/server\\.ts$'] },
      to: { path: ['^lib/db/', '^node_modules/@prisma/client'] },
    },
    ...engineRules,
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '^tests/fixtures/' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
