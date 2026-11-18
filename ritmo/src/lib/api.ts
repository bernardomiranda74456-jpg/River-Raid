/**
 * Acesso a dados. Toda regra sensível fica no servidor (RPCs + RLS); aqui só
 * montamos as consultas e normalizamos os resultados.
 */
import { supabase } from '@/lib/supabase';
import type { Factor, FactorTable } from '@/lib/factors';
import type { Comment, FeedWorkout, Group, Like, Member, Message, Period, Profile, Workout } from '@/lib/types';
import type { RankingRow } from '@/lib/scoring';

export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly retryable = false) {
    super(message);
  }
}

function isNetworkError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('failed to');
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = err as { message?: string; code?: string; details?: string };
  const network = isNetworkError(err);
  const message = network
    ? 'Sem conexão. Verifique a internet e tente de novo.'
    : e?.message || 'Algo deu errado. Tente de novo.';
  return new ApiError(message, e?.code, network);
}

async function unwrap<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  try {
    const { data, error } = await p;
    if (error) throw toApiError(error);
    return data as T;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---- Perfil ---------------------------------------------------------------
export const profilesApi = {
  me: (userId: string) => unwrap<Profile>(supabase.from('profiles').select('id, display_name, email').eq('id', userId).single()),
  updateName: (userId: string, name: string) =>
    unwrap(supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId).select('id').single()),
};

// ---- Grupos ---------------------------------------------------------------
export const groupsApi = {
  mine: async (): Promise<Group[]> => {
    const rows = await unwrap<{ group: Group }[]>(
      supabase.from('group_members').select('group:groups(*)').order('joined_at', { ascending: false }),
    );
    return rows.map((r) => r.group).filter(Boolean);
  },
  get: (id: string) => unwrap<Group>(supabase.from('groups').select('*').eq('id', id).single()),
  create: (name: string, startsOn: string, endsOn: string, timezone: string) =>
    unwrap<Group>(supabase.rpc('create_group', { p_name: name, p_starts_on: startsOn, p_ends_on: endsOn, p_timezone: timezone })),
  join: (code: string) => unwrap<Group>(supabase.rpc('join_group', { p_code: code })),
  update: (id: string, name: string, startsOn: string, endsOn: string) =>
    unwrap<Group>(supabase.rpc('update_group', { p_group_id: id, p_name: name, p_starts_on: startsOn, p_ends_on: endsOn })),
  members: async (groupId: string): Promise<Member[]> =>
    unwrap<Member[]>(
      supabase
        .from('group_members')
        .select('group_id, user_id, role, joined_at, profile:profiles(id, display_name)')
        .eq('group_id', groupId)
        .order('joined_at'),
    ),
  today: (groupId: string) => unwrap<string>(supabase.rpc('group_today', { p_group_id: groupId })),
};

// ---- Fatores --------------------------------------------------------------
export const factorsApi = {
  active: async (): Promise<FactorTable> => {
    const table = await unwrap<{ version: string; published_at: string; factors: Factor[] }>(
      supabase
        .from('factor_tables')
        .select('version, published_at, factors(id, code, modality, modality_label, variant_label, factor, provisional, sort_order)')
        .eq('is_active', true)
        .single(),
    );
    return { ...table, factors: table.factors.map((f) => ({ ...f, factor: Number(f.factor) })) };
  },
};

// ---- Treinos --------------------------------------------------------------
const FEED_SELECT =
  '*, author:profiles!workouts_user_id_fkey(id, display_name), likes:workout_likes(user_id), comments:workout_comments(count)';

function normalizeWorkout<T extends { factor_value: unknown }>(w: T): T {
  return { ...w, factor_value: Number(w.factor_value) };
}

export const workoutsApi = {
  feed: async (groupId: string, opts: { userId?: string; from?: string; to?: string } = {}): Promise<FeedWorkout[]> => {
    let q = supabase
      .from('workouts')
      .select(FEED_SELECT)
      .eq('group_id', groupId)
      .order('performed_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300);
    if (opts.userId) q = q.eq('user_id', opts.userId);
    if (opts.from) q = q.gte('performed_on', opts.from);
    if (opts.to) q = q.lte('performed_on', opts.to);
    const rows = await unwrap<FeedWorkout[]>(q);
    return rows.map(normalizeWorkout);
  },
  get: async (id: string): Promise<FeedWorkout> => normalizeWorkout(await unwrap<FeedWorkout>(supabase.from('workouts').select(FEED_SELECT).eq('id', id).single())),
  create: async (input: {
    groupId: string;
    clientId: string;
    performedOn: string;
    durationMin: number;
    factorCode: string;
    caption?: string | null;
    photoPath?: string | null;
  }): Promise<Workout> =>
    normalizeWorkout(
      await unwrap<Workout>(
        supabase.rpc('create_workout', {
          p_group_id: input.groupId,
          p_client_id: input.clientId,
          p_performed_on: input.performedOn,
          p_duration_min: input.durationMin,
          p_factor_code: input.factorCode,
          p_caption: input.caption ?? null,
          p_photo_path: input.photoPath ?? null,
        }),
      ),
    ),
  remove: (workoutId: string, reason: string) =>
    unwrap<Workout>(supabase.rpc('remove_workout', { p_workout_id: workoutId, p_reason: reason })),
  likes: (workoutId: string) =>
    unwrap<Like[]>(
      supabase.from('workout_likes').select('workout_id, user_id, created_at, profile:profiles(id, display_name)').eq('workout_id', workoutId).order('created_at'),
    ),
  like: (workoutId: string, userId: string) => unwrap(supabase.from('workout_likes').insert({ workout_id: workoutId, user_id: userId })),
  unlike: (workoutId: string, userId: string) =>
    unwrap(supabase.from('workout_likes').delete().eq('workout_id', workoutId).eq('user_id', userId)),
  comments: (workoutId: string) =>
    unwrap<Comment[]>(
      supabase.from('workout_comments').select('id, workout_id, user_id, body, created_at, author:profiles(id, display_name)').eq('workout_id', workoutId).order('created_at'),
    ),
  comment: (workoutId: string, userId: string, body: string) =>
    unwrap<Comment>(
      supabase
        .from('workout_comments')
        .insert({ workout_id: workoutId, user_id: userId, body: body.trim() })
        .select('id, workout_id, user_id, body, created_at, author:profiles(id, display_name)')
        .single(),
    ),
  deleteComment: (id: string) => unwrap(supabase.from('workout_comments').delete().eq('id', id)),
};

// ---- Ranking --------------------------------------------------------------
export const rankingApi = {
  list: async (groupId: string, period: Period): Promise<RankingRow[]> => {
    const rows = await unwrap<RankingRow[]>(supabase.rpc('group_ranking', { p_group_id: groupId, p_period: period }));
    return rows.map((r) => ({ ...r, points: Number(r.points), workouts: Number(r.workouts), minutes: Number(r.minutes) }));
  },
  window: async (groupId: string, period: Period): Promise<{ starts_on: string; ends_on: string }> => {
    const rows = await unwrap<{ starts_on: string; ends_on: string }[]>(
      supabase.rpc('ranking_window', { p_group_id: groupId, p_period: period }),
    );
    return rows[0];
  },
};

// ---- Chat -----------------------------------------------------------------
const MESSAGE_SELECT = 'id, group_id, user_id, body, created_at, author:profiles(id, display_name)';

export const chatApi = {
  list: (groupId: string, limit = 200) =>
    unwrap<Message[]>(supabase.from('messages').select(MESSAGE_SELECT).eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit)),
  send: (groupId: string, userId: string, body: string) =>
    unwrap<Message>(supabase.from('messages').insert({ group_id: groupId, user_id: userId, body: body.trim() }).select(MESSAGE_SELECT).single()),
  get: (id: string) => unwrap<Message>(supabase.from('messages').select(MESSAGE_SELECT).eq('id', id).single()),
};
