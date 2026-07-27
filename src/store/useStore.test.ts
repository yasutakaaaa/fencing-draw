import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Tournament, TournamentEvent } from '../types';

const dbMocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const upsert = vi.fn();
  const from = vi.fn(() => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle,
      upsert,
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    return builder;
  });
  return { from, maybeSingle, upsert };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: dbMocks.from,
    auth: {},
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

let useStore: typeof import('./useStore')['useStore'];
let fixtureNumber = 0;

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(() => null),
  length: 0,
};

function makeFixture(): { event: TournamentEvent; tournament: Tournament } {
  fixtureNumber += 1;
  const eventId = `event-${fixtureNumber}`;
  const categoryId = `category-${fixtureNumber}`;
  const poolPhaseId = `pool-${fixtureNumber}`;
  const dePhaseId = `de-${fixtureNumber}`;
  return {
    event: {
      id: eventId,
      ownerId: 'user-1',
      name: 'テスト大会',
      date: '2026-07-27',
      venue: 'テスト会場',
      status: '未',
      pin: '',
      categoryIds: [categoryId],
    },
    tournament: {
      id: categoryId,
      eventId,
      name: '変更前',
      date: '2026-07-27',
      weapon: 'フルーレ',
      gender: '男子',
      ageCategory: 'シニア',
      ageCategoryCustom: '',
      format: '個人',
      status: '準備中',
      fencers: [],
      phases: [
        { id: poolPhaseId, type: 'pool', maxPoolSize: 7, advancement: { type: 'percent', value: 70 } },
        { id: dePhaseId, type: 'de', thirdPlace: true, classification: false, classificationPlacements: [] },
      ],
      phaseRuntimes: [],
      activePhaseIdx: -1,
    },
  };
}

async function flushPromises() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
});

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllTimers();
  vi.resetModules();
  dbMocks.from.mockClear();
  dbMocks.maybeSingle.mockReset().mockResolvedValue({ data: { owner_id: 'user-1' }, error: null });
  dbMocks.upsert.mockReset().mockResolvedValue({ error: null });
  ({ useStore } = await import('./useStore'));

  const { event, tournament } = makeFixture();
  useStore.setState({
    user: { id: 'user-1' } as User,
    events: [event],
    tournaments: [tournament],
    currentId: tournament.id,
    currentEventId: event.id,
    saveStatus: 'idle',
    saveErrorDetail: null,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('大会更新の保存タイミング', () => {
  it('通常更新を1.5秒debounceし、最後の状態を1回だけ保存する', async () => {
    useStore.getState().setTournamentField('name', '変更1');
    vi.advanceTimersByTime(750);
    useStore.getState().setTournamentField('name', '変更2');

    await vi.advanceTimersByTimeAsync(1499);
    expect(dbMocks.upsert).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(dbMocks.upsert).toHaveBeenCalledTimes(1);
    const payload = dbMocks.upsert.mock.calls[0][0];
    const categoryId = useStore.getState().currentId!;
    expect(payload.data.categories[categoryId].name).toBe('変更2');
  });

  it('即時更新はdebounceタイマーを待たずに最新状態を保存する', async () => {
    useStore.getState().addFencer({
      lastName: '山田',
      firstName: '太郎',
      lastNameKana: 'やまだ',
      firstNameKana: 'たろう',
      club: 'テストクラブ',
    });

    expect(dbMocks.maybeSingle).toHaveBeenCalledTimes(1);
    await flushPromises();

    expect(dbMocks.upsert).toHaveBeenCalledTimes(1);
    const payload = dbMocks.upsert.mock.calls[0][0];
    const categoryId = useStore.getState().currentId!;
    expect(payload.data.categories[categoryId].fencers).toHaveLength(1);
  });

  it('予約後に別カテゴリへ移動しても、予約時の大会を保存する', async () => {
    const firstEventId = useStore.getState().currentEventId!;
    const firstCategoryId = useStore.getState().currentId!;
    useStore.getState().setTournamentField('name', '移動前に変更');

    const second = makeFixture();
    useStore.setState(state => ({
      events: [...state.events, second.event],
      tournaments: [...state.tournaments, second.tournament],
      currentId: second.tournament.id,
      currentEventId: second.event.id,
    }));

    await vi.advanceTimersByTimeAsync(1500);
    await flushPromises();

    expect(dbMocks.upsert).toHaveBeenCalledTimes(1);
    const payload = dbMocks.upsert.mock.calls[0][0];
    expect(payload.id).toBe(firstEventId);
    expect(payload.data.categories[firstCategoryId].name).toBe('移動前に変更');
  });

  it('即時保存は既に予約されたdebounce保存を取り消さない', async () => {
    useStore.getState().setTournamentField('name', '予約済み変更');
    useStore.getState().addFencer({
      lastName: '山田',
      firstName: '太郎',
      lastNameKana: 'やまだ',
      firstNameKana: 'たろう',
      club: 'テストクラブ',
    });
    await flushPromises();
    expect(dbMocks.upsert).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1500);
    await flushPromises();
    expect(dbMocks.upsert).toHaveBeenCalledTimes(2);
  });

  it('未ログイン時はローカル状態だけ更新し、DB保存しない', async () => {
    useStore.setState({ user: null });
    useStore.getState().setTournamentField('name', 'ローカル変更');

    await vi.advanceTimersByTimeAsync(1500);
    await flushPromises();

    expect(useStore.getState().tournaments[0].name).toBe('ローカル変更');
    expect(dbMocks.upsert).not.toHaveBeenCalled();
  });

  it('イベントに紐づかないカテゴリはDB保存しない', async () => {
    const categoryId = useStore.getState().currentId!;
    useStore.setState(state => ({
      tournaments: state.tournaments.map(tournament =>
        tournament.id === categoryId ? { ...tournament, eventId: undefined } : tournament
      ),
    }));

    useStore.getState().setTournamentField('name', '未紐付け変更');
    await vi.advanceTimersByTimeAsync(1500);
    await flushPromises();

    expect(dbMocks.upsert).not.toHaveBeenCalled();
  });
});
