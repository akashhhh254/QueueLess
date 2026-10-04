export type UserRole = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

export interface User {
  id: string;
  google_id: string;
  name: string;
  email: string;
  profile_image: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type LocationType =
  | 'HOSPITAL'
  | 'BANK'
  | 'GOVERNMENT_OFFICE'
  | 'DIAGNOSTIC_CENTER'
  | 'COLLEGE'
  | 'SERVICE_CENTER'
  | 'OTHER';

export interface ServiceLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  type: LocationType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  servicesCount?: number;
  activeQueuesCount?: number;
}

export interface ServiceItem {
  id: string;
  location_id: string;
  name: string;
  description: string | null;
  average_service_time: number;
  is_active: number;
  created_at: string;
  queues?: QueueItem[];
}

export type QueueStatus = 'NORMAL' | 'BUSY' | 'DELAYED' | 'PAUSED' | 'CLOSED';

export interface QueueItem {
  id: string;
  service_id: string;
  name: string;
  prefix: string;
  current_token_number: number;
  average_service_time: number;
  status: QueueStatus;
  active_counters_count: number;
  created_at: string;
  updated_at: string;
  waitingCount?: number;
  nowServing?: string;
}

export interface CounterItem {
  id: string;
  location_id: string;
  service_id: string | null;
  name: string;
  counter_number: number;
  assigned_provider_id: string | null;
  current_queue_entry_id: string | null;
  is_active: number;
  created_at: string;
}

export type QueueEntryStatus =
  | 'WAITING'
  | 'CALLED'
  | 'SERVING'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'MISSED'
  | 'CANCELLED';

export interface QueueEntry {
  id: string;
  queue_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  token_number: string;
  raw_sequence: number;
  status: QueueEntryStatus;
  is_away: number;
  position: number;
  estimated_wait: number;
  joined_at: string;
  called_at: string | null;
  served_at: string | null;
  completed_at: string | null;
  missed_at: string | null;
  counter_id: string | null;
  counter_name?: string;
  priority_reason: string | null;
  queue_name?: string;
  queue_prefix?: string;
  queue_status?: QueueStatus;
  queue_avg_time?: number;
  service_name?: string;
  location_name?: string;
  location_address?: string;
  peopleAhead?: number;
  nowServingToken?: string;
}

export type NotificationType =
  | 'QUEUE_JOINED'
  | 'QUEUE_UPDATED'
  | 'TURN_APPROACHING'
  | 'YOUR_TURN'
  | 'QUEUE_DELAYED'
  | 'SERVICE_RESUMED'
  | 'QUEUE_COMPLETED';

export interface NotificationItem {
  id: string;
  user_id: string;
  queue_entry_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_user_id: string | null;
  actor_name?: string;
  actor_email?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string | null;
  created_at: string;
}

export interface AnalyticsData {
  totalServed: number;
  totalWaiting: number;
  totalSkipped: number;
  totalCancelled: number;
  avgWaitMinutes: number;
  avgServiceMinutes: number;
  hourlyData: Array<{ hour: string; served: number; waiting: number }>;
  locationBreakdown: Array<{ name: string; total_entries: number }>;
}
