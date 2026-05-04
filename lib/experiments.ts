import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

interface Variant {
  name: string;
  weight: number;
}

interface ExperimentRow {
  id: string;
  key: string;
  status: string;
  variants: Variant[];
}

let serviceClient: SupabaseClient | null = null;
function service(): SupabaseClient | null {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  serviceClient = createClient(url, key);
  return serviceClient;
}

function pickDeterministic(experimentKey: string, userId: string, variants: Variant[]): string {
  const totalWeight = variants.reduce((acc, v) => acc + Math.max(0, v.weight), 0);
  if (totalWeight <= 0) return variants[0]?.name ?? 'control';
  const hash = createHash('sha256').update(`${experimentKey}:${userId}`).digest();
  const slot = (hash.readUInt32BE(0) % 1_000_000) / 1_000_000;
  let cursor = 0;
  for (const v of variants) {
    cursor += v.weight / totalWeight;
    if (slot < cursor) return v.name;
  }
  return variants[variants.length - 1].name;
}

/**
 * Look up the user's variant for a running experiment, creating a sticky
 * assignment on first call. Returns null if the experiment doesn't exist
 * or isn't 'running'. Safe to call repeatedly — assignments are idempotent.
 */
export async function assignVariant(userId: string, experimentKey: string): Promise<string | null> {
  const client = service();
  if (!client) return null;

  const { data: exp } = await client
    .from('experiments')
    .select('id, key, status, variants')
    .eq('key', experimentKey)
    .maybeSingle();

  if (!exp) return null;
  const experiment = exp as ExperimentRow;
  if (experiment.status !== 'running') return null;

  const { data: existing } = await client
    .from('experiment_assignments')
    .select('variant_name')
    .eq('experiment_id', experiment.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return (existing as { variant_name: string }).variant_name;

  const variants = Array.isArray(experiment.variants) ? experiment.variants : [];
  if (variants.length === 0) return null;
  const variant = pickDeterministic(experimentKey, userId, variants);

  await client.from('experiment_assignments').insert({
    experiment_id: experiment.id,
    user_id: userId,
    variant_name: variant,
  });

  return variant;
}

/**
 * Record a conversion event for a running experiment. value is optional
 * numeric (e.g. revenue). No-ops if the experiment doesn't exist.
 */
export async function recordExperimentEvent(
  userId: string,
  experimentKey: string,
  eventName: string,
  value?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const client = service();
  if (!client) return;

  const { data: exp } = await client
    .from('experiments')
    .select('id')
    .eq('key', experimentKey)
    .maybeSingle();

  if (!exp) return;

  await client.from('experiment_events').insert({
    experiment_id: (exp as { id: string }).id,
    user_id: userId,
    event_name: eventName,
    value: value ?? null,
    metadata: metadata ?? {},
  });
}
