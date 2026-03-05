/**
 * Public booking API - no auth required.
 */

import { apiGet, apiPost } from './api';

export interface Location {
  id: string;
  name: string;
  address: string;
  resources: Resource[];
}

export interface Resource {
  id: string;
  type: 'CONFERENCE_ROOM' | 'DISCUSSION_ROOM' | 'DAY_PASS_DESK';
  capacity: number;
  location?: { id: string; name: string; address: string };
  pricing?: { hourlyPrice: number | null; dayPrice: number | null };
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isFullDay: boolean;
  isActive: boolean;
}

export interface PricingResponse {
  resource: Resource & { location: { id: string; name: string; address: string } };
  pricing: { hourlyPrice: number | null; dayPrice: number | null } | null;
  availableSlots: TimeSlot[];
  remainingCapacity?: number | null;
}

export interface CreateOrderRequest {
  resourceId: string;
  date: string;
  timeSlotId?: string;
  /** Multiple slot IDs (e.g. for room hourly slots). When set, used instead of timeSlotId. */
  timeSlotIds?: string[];
  quantity: number;
  name: string;
  email: string;
  phone: string;
}

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  bookingId: string;
}

export async function getLocations(): Promise<Location[]> {
  return apiGet<Location[]>('/public/locations');
}

export async function getTimeSlots(): Promise<TimeSlot[]> {
  return apiGet<TimeSlot[]>('/public/time-slots');
}

export async function getPricing(resourceId: string, date?: string): Promise<PricingResponse> {
  const path = date
    ? `/public/pricing/${resourceId}?date=${encodeURIComponent(date)}`
    : `/public/pricing/${resourceId}`;
  return apiGet<PricingResponse>(path);
}

export async function createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
  return apiPost<CreateOrderResponse>('/public/create-order', data);
}

/** Get Razorpay Key ID for client checkout (from backend when env is not set). */
export async function getRazorpayKeyId(): Promise<string | null> {
  const res = await apiGet<{ keyId: string | null }>('/public/razorpay-key');
  return res?.keyId ?? null;
}
