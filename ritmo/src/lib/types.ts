export type Profile = { id: string; display_name: string; email?: string | null };

export type Group = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  timezone: string;
  starts_on: string;
  ends_on: string;
  created_at: string;
};

export type Member = { group_id: string; user_id: string; role: 'organizer' | 'member'; joined_at: string; profile: Profile };

export type Workout = {
  id: string;
  group_id: string;
  user_id: string;
  client_id: string;
  performed_on: string;
  duration_min: number;
  factor_table_version: string;
  factor_code: string;
  modality: string;
  modality_label: string;
  variant_label: string;
  factor_value: number;
  points: number;
  caption: string | null;
  photo_path: string | null;
  created_at: string;
  removed_at: string | null;
  removed_by: string | null;
  removal_reason: string | null;
};

export type FeedWorkout = Workout & {
  author: Profile;
  likes: { user_id: string }[];
  comments: { count: number }[];
};

export type Comment = { id: string; workout_id: string; user_id: string; body: string; created_at: string; author: Profile };
export type Like = { workout_id: string; user_id: string; created_at: string; profile: Profile };
export type Message = { id: string; group_id: string; user_id: string; body: string; created_at: string; author: Profile };
export type Period = 'challenge' | '7d';
