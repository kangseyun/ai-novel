/**
 * LUMIN group and member constants.
 *
 * LUMIN is the seven-member persona group that powers the platform.
 * Use these constants instead of hardcoding member IDs anywhere in the codebase.
 */

export const LUMIN_GROUP_ID = 'lumin';

/**
 * Default LUMIN member used as a fallback when no member context is available.
 * `haeon` is the group leader and the safe stable choice for fallbacks.
 */
export const DEFAULT_LUMIN_MEMBER_ID = 'haeon';

/**
 * Canonical ordered list of LUMIN member IDs.
 */
export const LUMIN_MEMBER_IDS = [
  'haeon',
  'kael',
  'ren',
  'jun',
  'adrian',
  'sol',
  'noa',
] as const;

export type LuminMemberId = (typeof LUMIN_MEMBER_IDS)[number];

export function isLuminMemberId(id: string): id is LuminMemberId {
  return (LUMIN_MEMBER_IDS as readonly string[]).includes(id);
}
