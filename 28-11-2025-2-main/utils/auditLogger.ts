import { ActivityLog } from '../types';
import { generateId } from './idUtils';

export const createAuditLog = (
  action: string,
  details: string,
  entityType: ActivityLog['entityType'],
  userName: string = 'المحامي العام',
  entityId?: string
): ActivityLog => {
  return {
    id: generateId(),
    action,
    details,
    timestamp: new Date().toISOString(),
    userName,
    entityType,
    entityId,
  };
};
