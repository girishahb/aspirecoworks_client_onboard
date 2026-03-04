/**
 * Admin Booking Monitor API
 */

import { apiGet } from './api';

export interface BookingStats {
  todayRevenue: number;
  todayBookings: number;
  totalRevenue: number;
  occupancyPercent: number;
}

export interface RevenueByDate {
  date: string;
  revenue: number;
}

export interface BookingListItem {
  id: string;
  locationName: string;
  resourceType: string;
  timeSlot: string | null;
  quantity: number;
  amountPaid: number;
  status: string;
  createdAt: string;
  date: string;
  name: string;
  email: string;
  phone: string;
}

export interface ListBookingsResult {
  data: BookingListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ListBookingsParams {
  page?: number;
  limit?: number;
  locationId?: string;
  date?: string;
  status?: string;
  search?: string;
}

export async function getBookingStats(): Promise<BookingStats> {
  return apiGet<BookingStats>('/admin/bookings/stats');
}

export async function getRevenueByDate(range: '7days' | '30days' = '7days'): Promise<RevenueByDate[]> {
  return apiGet<RevenueByDate[]>(`/admin/bookings/revenue?range=${range}`);
}

export async function listBookings(params?: ListBookingsParams): Promise<ListBookingsResult> {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.locationId) search.set('locationId', params.locationId);
  if (params?.date) search.set('date', params.date);
  if (params?.status) search.set('status', params.status);
  if (params?.search?.trim()) search.set('search', params.search.trim());
  const qs = search.toString();
  const path = qs ? `/admin/bookings?${qs}` : '/admin/bookings';
  return apiGet<ListBookingsResult>(path);
}

export interface Location {
  id: string;
  name: string;
  address: string;
}

export async function getLocations(): Promise<Location[]> {
  return apiGet<Location[]>('/admin/locations');
}
