// Path builders, param parsing and the sticky sim params (routes.md 3, 6.3, 6.4, 4.7; 7.3).
import { describe, expect, it } from 'vitest';
import { topCrumbs, truncateName } from '@/lib/nav/breadcrumbs';
import { parseIdRef, whereId } from '@/lib/routes/params';
import {
  advertiserPath,
  basePath,
  campaignPath,
  campaignTabSegment,
  homePath,
  ioPath,
  levelOf,
  lineItemLanding,
  liPath,
  newIoTarget,
  newLiTarget,
  newTargetFor,
  notFoundPath,
  partnerPath,
  reportingPath,
} from '@/lib/routes/paths';
import { withSimParams } from '@/lib/routes/sim-params';

const ids = { partnerId: '1', advertiserId: '2', campaignId: '3', ioId: '4', liId: '5' };

describe('path builders', () => {
  it('build every level with optional sub paths', () => {
    expect(partnerPath('1')).toBe('/p/1');
    expect(partnerPath('1', 'home_v3')).toBe('/p/1/home_v3');
    expect(partnerPath('1', 'brand', 'controls')).toBe('/p/1/brand/controls');
    expect(advertiserPath('1', '2', 'cs', 'new')).toBe('/p/1/a/2/cs/new');
    expect(campaignPath('1', '2', '3')).toBe('/p/1/a/2/c/3');
    expect(ioPath('1', '2', '3', '4', 'explorerlis')).toBe('/p/1/a/2/c/3/io/4/explorerlis');
    expect(liPath('1', '2', '3', '4', '5', 'details')).toBe('/p/1/a/2/c/3/io/4/li/5/details');
    expect(partnerPath('1', '', 'x')).toBe('/p/1/x');
  });

  it('home and reports links of the top bar (routes.md 4.1 items 3 and 11)', () => {
    expect(homePath({})).toBe('/');
    expect(homePath({ partnerId: '1' })).toBe('/p/1/home_v3');
    expect(reportingPath({})).toBeNull();
    expect(reportingPath({ partnerId: '1' })).toBe('/p/1/reporting');
    expect(reportingPath({ partnerId: '1', advertiserId: '2' })).toBe('/p/1/reporting?sim_aid=2');
  });

  it('the catch-all destination encodes the path (routes.md 6.5)', () => {
    expect(notFoundPath('/p/1/a/2/audiences?x=1')).toBe(
      '/404?url=%2Fp%2F1%2Fa%2F2%2Faudiences%3Fx%3D1',
    );
  });

  it('levels and level bases', () => {
    expect(levelOf({})).toBe('global');
    expect(levelOf({ partnerId: '1' })).toBe('partner');
    expect(levelOf({ partnerId: '1', advertiserId: '2' })).toBe('advertiser');
    expect(levelOf(ids)).toBe('li');
    expect(basePath('global', ids)).toBe('');
    expect(basePath('campaign', ids)).toBe('/p/1/a/2/c/3');
    expect(basePath('li', ids)).toBe('/p/1/a/2/c/3/io/4/li/5');
    expect(basePath('io', { partnerId: '1' })).toBeNull();
  });

  it('redirect targets of routes.md 6.3', () => {
    expect(campaignTabSegment(null)).toBe('explorerios');
    expect(campaignTabSegment('lis')).toBe('explorerlis');
    expect(campaignTabSegment('combined')).toBe('explorercombined');
    expect(lineItemLanding('YT_VIDEO')).toBe('adgroups');
    expect(lineItemLanding('DEMAND_GEN')).toBe('adgroups');
    expect(lineItemLanding('DISPLAY')).toBe('details');
  });

  it('Shift+N, Shift+I and Shift+L targets (routes.md 4.7, AC-01-15)', () => {
    const adv = { partnerId: '1', advertiserId: '2' };
    expect(newTargetFor('/p/1/a/2/cs', adv)).toBe('/p/1/a/2/cs/new');
    expect(newTargetFor('/p/1/home_v3', { partnerId: '1' })).toBeNull();
    expect(newTargetFor('/p/1/a/2/history', adv)).toBeNull();
    const cmp = { ...adv, campaignId: '3' };
    expect(newTargetFor('/p/1/a/2/c/3/explorerios', cmp)).toBe('/p/1/a/2/c/3/ios/new');
    expect(newTargetFor('/p/1/a/2/c/3/details', cmp)).toBeNull();
    const io = { ...cmp, ioId: '4' };
    expect(newTargetFor('/p/1/a/2/c/3/io/4/explorerlis', io)).toBe(
      '/p/1/a/2/c/3/io/4/lis/new',
    );
    expect(newIoTarget(cmp)).toBe('/p/1/a/2/c/3/ios/new');
    expect(newIoTarget(io)).toBeNull();
    expect(newIoTarget(adv)).toBeNull();
    expect(newLiTarget(io)).toBe('/p/1/a/2/c/3/io/4/lis/new');
    expect(newLiTarget(ids)).toBeNull();
    expect(newLiTarget(cmp)).toBeNull();
  });
});

describe('id params (routes.md 6.4)', () => {
  it('accepts public ids and row ids, rejects anything else', () => {
    expect(parseIdRef('42')).toEqual({ kind: 'public', value: 42n });
    expect(parseIdRef('cabcdefghijklmnopqrstuvwx')).toEqual({
      kind: 'row',
      value: 'cabcdefghijklmnopqrstuvwx',
    });
    for (const bad of [undefined, '', '0', '01', '-1', '1.5', 'abc', '../x', '9'.repeat(20)]) {
      expect(parseIdRef(bad), String(bad)).toBeNull();
    }
  });

  it('builds the Prisma where', () => {
    expect(whereId({ kind: 'public', value: 7n })).toEqual({ publicId: 7n });
    expect(whereId({ kind: 'row', value: 'cx' })).toEqual({ id: 'cx' });
  });
});

describe('sticky sim params (routes.md 7.3)', () => {
  it('copies sim_as, sim_act and sim_class into in-app links', () => {
    expect(withSimParams('/p/1/home_v3', 'sim_as=u1&sim_act=1&other=x')).toBe(
      '/p/1/home_v3?sim_as=u1&sim_act=1',
    );
    expect(withSimParams('/p/1/reporting?sim_aid=2#top', 'sim_class=c1')).toBe(
      '/p/1/reporting?sim_aid=2&sim_class=c1#top',
    );
  });

  it('keeps a value the link sets itself, and leaves external links and empty state alone', () => {
    expect(withSimParams('/x?sim_as=u2', 'sim_as=u1')).toBe('/x?sim_as=u2');
    expect(withSimParams('https://example.test/x', 'sim_as=u1')).toBe('https://example.test/x');
    expect(withSimParams('//example.test/x', 'sim_as=u1')).toBe('//example.test/x');
    expect(withSimParams('/x', null)).toBe('/x');
    expect(withSimParams('/x', 'sim_panel=notes:1')).toBe('/x');
  });
});

describe('top bar crumbs (routes.md 4.5)', () => {
  it('stop at campaign level and link each level', () => {
    expect(topCrumbs({})).toEqual([]);
    expect(
      topCrumbs({
        partner: { publicId: '1', name: 'Agency' },
        advertiser: { publicId: '2', name: 'Shop' },
        campaign: { publicId: '3', name: 'Diwali' },
      }),
    ).toEqual([
      { level: 'Partner', name: 'Agency', href: '/p/1/home_v3' },
      { level: 'Advertiser', name: 'Shop', href: '/p/1/a/2/cs' },
      { level: 'Campaign', name: 'Campaign Diwali', href: '/p/1/a/2/c/3' },
    ]);
  });

  it('truncate names over 24 characters', () => {
    expect(truncateName('a'.repeat(24))).toBe('a'.repeat(24));
    expect(truncateName('a'.repeat(30))).toBe(`${'a'.repeat(23)}…`);
  });
});
