import { renderMoment } from '@/engine/render';
import { MOMENT_CATALOG } from '@/engine/catalog';
import { buildDemoSnapshot, DEFAULT_DEMO_STATE, simulate } from '@/demo/demoLeague';
import { DEMO_MEMBERS } from '@/demo/members';
import { DEMO_TODAY } from '@/demo/scenario';

const { outputs } = simulate(DEMO_TODAY);
const byDate = (d: string) => outputs.find((o) => o.date === d)!;

describe('Moment Engine on the demo League', () => {
  it('is deterministic', () => {
    const again = simulate('2026-09-25');
    expect(JSON.stringify(again.outputs.find((o) => o.date === '2026-09-20'))).toEqual(
      JSON.stringify(byDate('2026-09-20')),
    );
  });

  it('produces the scripted signature moments', () => {
    const bromance = byDate('2026-09-24').moments.find((m) => m.type === 'BROMANCE');
    expect(bromance?.memberIds).toEqual(['hippolyte', 'joseph']);
    expect(bromance?.vars.minutes.v).toBe(374);

    const d25 = byDate('2026-09-25').moments;
    expect(d25.find((m) => m.type === 'TROUBLE_IN_PARADISE')?.memberIds).toEqual(['hippolyte', 'joseph']);
    const missing = d25.find((m) => m.type === 'MISSING');
    expect(missing?.memberIds).toEqual(['tom']);
    expect(missing?.vars.hours.v).toBe(26);
    expect(d25.find((m) => m.type === 'WEIRDLY_IN_SYNC')?.memberIds.sort()).toEqual(['arthur', 'tom']);

    const linkUp = byDate('2026-09-19').moments.find((m) => m.type === 'THE_LINK_UP');
    expect(linkUp?.memberIds).toHaveLength(6);
    expect(linkUp?.vars.biggest.v).toBe('yes');

    const record = byDate('2026-09-22').moments.find((m) => m.type === 'RECORD_BROKEN');
    expect(record?.memberIds).toEqual(['joseph']);
    expect(record?.vars.value.v).toBe(18492);
  });

  it('builds varied Drops: one battle, one card per type, mostly social', () => {
    let social = 0;
    let total = 0;
    for (const out of outputs) {
      const types = out.moments.map((m) => m.type);
      expect(new Set(types).size).toBe(types.length);
      expect(types.filter((t) => t === 'TODAYS_BATTLE')).toHaveLength(1);
      expect(out.moments.length).toBeLessThanOrEqual(8);
      expect(out.moments.length).toBeGreaterThanOrEqual(3);
      const competitive = out.moments.filter((m) => MOMENT_CATALOG[m.type].category === 'competitive').length;
      expect(competitive).toBeLessThanOrEqual(2);
      social += out.moments.length - competitive;
      total += out.moments.length;
    }
    expect(social / total).toBeGreaterThan(0.6);
  });

  it('shows a wide variety of moment types across the demo', () => {
    const types = new Set(outputs.flatMap((o) => o.moments.map((m) => m.type)));
    expect(types.size).toBeGreaterThanOrEqual(14);
  });

  it('labels every demo moment as simulated', () => {
    expect(outputs.every((o) => o.moments.every((m) => m.provenance === 'simulated'))).toBe(true);
  });

  it('avoids repeating the same caption back-to-back for a type', () => {
    const bromances = outputs.flatMap((o) => o.moments).filter((m) => m.type === 'BROMANCE');
    for (let i = 1; i < bromances.length; i++) {
      const a = renderMoment(bromances[i - 1], DEMO_MEMBERS).caption;
      const b = renderMoment(bromances[i], DEMO_MEMBERS).caption;
      expect(a).not.toEqual(b);
    }
  });

  it('renders every moment without leftover placeholders', () => {
    for (const m of outputs.flatMap((o) => o.moments)) {
      const r = renderMoment(m, DEMO_MEMBERS);
      expect(`${r.headline} ${r.caption}`).not.toMatch(/\{\w+\}/);
      expect(r.headline.length).toBeGreaterThan(5);
    }
  });
});

describe('demo snapshot', () => {
  it('hides today until revealed and counts points only for revealed days', () => {
    const locked = buildDemoSnapshot(DEFAULT_DEMO_STATE);
    expect(locked.drops[0].date).toBe('2026-09-25');
    expect(locked.today.pendingMoments).toBeGreaterThan(0);
    const revealed = buildDemoSnapshot({ ...DEFAULT_DEMO_STATE, revealed: true });
    expect(revealed.drops[0].date).toBe(DEMO_TODAY);
    const pts = (s: typeof locked) => s.standings.reduce((x, r) => x + r.points, 0);
    expect(pts(revealed)).toBeGreaterThan(pts(locked));
  });

  it('has a closed August season with a recap', () => {
    const snap = buildDemoSnapshot(DEFAULT_DEMO_STATE);
    expect(snap.pastSeasons.map((s) => s.season.month)).toEqual(['2026-08']);
    expect(snap.pastSeasons[0].championId).not.toBeNull();
    expect(snap.pastSeasons[0].awards.length).toBeGreaterThan(4);
  });
});
