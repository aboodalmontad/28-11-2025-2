import { ActivityLog } from '../types';
import { generateId } from './idUtils';

export const createAuditLog = (
  action: string,
  details: string,
  entity_type: string = 'general',
  user_name: string = 'المحامي العام',
  entity_id?: string,
  user_id: string = 'system'
): ActivityLog => {
  return {
    id: generateId(),
    action,
    details,
    created_at: new Date().toISOString(),
    user_name,
    user_id,
    entity_type,
    entity_id,
  };
};

export const logActivity = async (
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  userName?: string
) => {
  console.log("Log activity:", { userId, action, entityType, entityId, details, userName });
};
