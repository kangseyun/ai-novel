import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AdminAuditEntry {
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient | null {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  serviceClient = createClient(url, key);
  return serviceClient;
}

export async function recordAdminAction(entry: AdminAuditEntry): Promise<void> {
  const client = getServiceClient();
  if (!client) return;

  const row = {
    admin_user_id: entry.adminUserId,
    admin_email: entry.adminEmail,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    reason: entry.reason ?? null,
    before_state: entry.before ?? {},
    after_state: entry.after ?? {},
    metadata: entry.metadata ?? {},
  };

  await client.from('admin_audit_log').insert(row);
}
