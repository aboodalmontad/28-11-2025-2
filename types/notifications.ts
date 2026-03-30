export interface RealtimeAlert {
    id: number;
    message: string;
    type?: 'sync' | 'userApproval';
}
