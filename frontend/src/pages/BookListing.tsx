import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MapPin,
  Users,
  Wifi,
  Zap,
  Coffee,
  SlidersHorizontal,
  X,
  Snowflake,
  Star,
} from 'lucide-react';
import { getLocations, type Location, type Resource } from '../services/bookings';
import { cn } from '../lib/utils';
import Toast from '../components/Toast';

type ResourceType = Resource['type'];

type CategoryId = 'ALL' | 'BOARDROOM' | 'DAY_PASS' | 'HOURLY_PASS' | 'MEETING_ROOM';

interface CategoryDef {
  id: CategoryId;
  label: string;
  match: (res: Resource) => boolean;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'ALL', label: 'All Spaces', match: () => true },
  { id: 'BOARDROOM', label: 'Boardroom', match: (r) => r.type === 'CONFERENCE_ROOM' },
  { id: 'DAY_PASS', label: 'Day Pass', match: (r) => r.type === 'DAY_PASS_DESK' },
  {
    id: 'HOURLY_PASS',
    label: 'Hourly Pass',
    match: (r) => r.type === 'CONFERENCE_ROOM' || r.type === 'DISCUSSION_ROOM',
  },
  { id: 'MEETING_ROOM', label: 'Meeting Room', match: (r) => r.type === 'DISCUSSION_ROOM' },
];

const RESOURCE_LABELS: Record<ResourceType, string> = {
  CONFERENCE_ROOM: 'Conference Room',
  DISCUSSION_ROOM: 'Discussion Room',
  DAY_PASS_DESK: 'Hot Desk',
};

// Unsplash-hosted workspace images (CDN-cached). Swap with brand assets later.
const RESOURCE_IMAGES: Record<ResourceType, string[]> = {
  CONFERENCE_ROOM: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=70',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=70',
  ],
  DISCUSSION_ROOM: [
    'https://images.unsplash.com/photo-1604328698692-f76ea9498e76?auto=format&fit=crop&w=900&q=70',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=900&q=70',
  ],
  DAY_PASS_DESK: [
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=70',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=70',
  ],
};

function pickImage(resource: Resource, seed: number): string {
  const pool = RESOURCE_IMAGES[resource.type] ?? RESOURCE_IMAGES.CONFERENCE_ROOM;
  return pool[seed % pool.length];
}

interface CardResource {
  id: string;
  name: string;
  type: ResourceType;
  capacity: number;
  locationId: string;
  locationName: string;
  locationAddress: string;
  price: number;
  priceUnit: string;
  image: string;
  highlighted: boolean;
  isActive: boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="h-44 bg-slate-100 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-2/3 rounded bg-slate-100 animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
        <div className="h-9 w-full rounded-lg bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

interface FilterState {
  category: CategoryId;
  locationId: string | 'ALL';
  minPrice: number;
  maxPrice: number;
  availableOnly: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  category: 'ALL',
  locationId: 'ALL',
  minPrice: 0,
  maxPrice: 100000,
  availableOnly: false,
};

export default function BookListing() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((e) => {
        setToast(e instanceof Error ? e.message : 'Failed to load spaces');
      })
      .finally(() => setLoading(false));
  }, []);

  const allResources: CardResource[] = useMemo(() => {
    const list: CardResource[] = [];
    locations.forEach((loc, locIdx) => {
      (loc.resources ?? []).forEach((res, rIdx) => {
        const isDesk = res.type === 'DAY_PASS_DESK';
        const price = isDesk
          ? res.pricing?.dayPrice ?? 0
          : res.pricing?.hourlyPrice ?? 0;
        const unit = isDesk ? '/day' : '/hour';
        list.push({
          id: res.id,
          name: `${RESOURCE_LABELS[res.type]} - ${loc.name}`,
          type: res.type,
          capacity: res.capacity,
          locationId: loc.id,
          locationName: loc.name,
          locationAddress: loc.address,
          price,
          priceUnit: unit,
          image: pickImage(res, locIdx * 7 + rIdx),
          highlighted: locIdx * 7 + rIdx < 2,
          isActive: (res as { isActive?: boolean }).isActive !== false,
        });
      });
    });
    return list;
  }, [locations]);

  const priceBounds = useMemo(() => {
    if (allResources.length === 0) return { min: 0, max: 10000 };
    const prices = allResources.map((r) => r.price).filter((p) => p > 0);
    if (prices.length === 0) return { min: 0, max: 10000 };
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [allResources]);

  const filtered = useMemo(() => {
    const category = CATEGORIES.find((c) => c.id === filters.category) ?? CATEGORIES[0];
    const q = search.trim().toLowerCase();
    return allResources.filter((res) => {
      if (!category.match({ id: res.id, type: res.type, capacity: res.capacity } as Resource))
        return false;
      if (filters.locationId !== 'ALL' && res.locationId !== filters.locationId) return false;
      if (res.price < filters.minPrice) return false;
      if (res.price > filters.maxPrice) return false;
      if (filters.availableOnly && !res.isActive) return false;
      if (q) {
        const hay = `${res.name} ${res.locationName} ${res.locationAddress}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allResources, filters, search]);

  const handleBook = useCallback(
    (resourceId: string) => {
      navigate(`/book/${resourceId}`);
    },
    [navigate]
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearch('');
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category !== 'ALL') count++;
    if (filters.locationId !== 'ALL') count++;
    if (filters.minPrice > 0) count++;
    if (filters.maxPrice < 100000) count++;
    if (filters.availableOnly) count++;
    return count;
  }, [filters]);

  return (
    <div className="min-h-[70vh] bg-slate-50 pb-20">
      <AnimatePresence>
        {toast && (
          <Toast
            key={toast}
            message={toast}
            type="error"
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* HERO */}
      <section className="relative">
        <div
          className="relative h-[420px] sm:h-[480px] w-full overflow-hidden"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/70" />
          <div className="relative h-full flex flex-col items-center justify-center px-4 text-center text-white">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/20">
                <Star className="w-3.5 h-3.5 text-lime-300" />
                Premium coworking at Aspire Coworks
              </span>
              <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
                Find your perfect Workspace
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-100/90">
                Flexible coworking spaces for hourly and daily use.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Glass search panel overlapping hero */}
        <div className="px-4 -mt-16 sm:-mt-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto max-w-4xl rounded-2xl border border-white/40 bg-white/80 backdrop-blur-xl shadow-xl p-3 sm:p-4"
          >
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              {CATEGORIES.map((cat) => {
                const active = filters.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, category: cat.id }))}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by location or space name..."
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  document.getElementById('listing-grid')?.scrollIntoView({ behavior: 'smooth' })
                }
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Search
              </button>
            </div>
            {locations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, locationId: 'ALL' }))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    filters.locationId === 'ALL'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300'
                  )}
                >
                  All locations
                </button>
                {locations.map((loc) => {
                  const active = filters.locationId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, locationId: loc.id }))}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300'
                      )}
                    >
                      {loc.name}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* LISTING */}
      <section id="listing-grid" className="mx-auto max-w-6xl px-4 mt-10 sm:mt-14">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Top-booked Spaces Loved by Our Clients
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Browse, compare and book in seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-slate-900 text-white text-[10px] px-2 py-0.5 font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-slate-600 font-medium">
              No spaces available for selected filters
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Try broadening the filters or search term.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-800"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {filtered.map((res, idx) => (
              <motion.article
                key={res.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(idx * 0.05, 0.3) }}
                whileHover={{ y: -4 }}
                className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={res.image}
                    alt={res.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {res.highlighted && (
                    <span className="absolute top-3 right-3 rounded-md bg-lime-300 text-slate-900 text-[11px] font-bold px-2 py-1 shadow-sm">
                      Highest booked
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-white/90 backdrop-blur px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
                    <MapPin className="w-3 h-3" /> {res.locationName}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                      {RESOURCE_LABELS[res.type]}
                    </h3>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-semibold',
                        res.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {res.isActive ? 'Available' : 'Full'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" /> {res.capacity} seats
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-slate-400">
                    <Wifi className="w-4 h-4" />
                    <Snowflake className="w-4 h-4" />
                    <Zap className="w-4 h-4" />
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        From
                      </p>
                      <p className="text-xl font-bold text-slate-900">
                        ₹{res.price.toLocaleString('en-IN')}
                        <span className="text-xs font-medium text-slate-500">
                          {res.priceUnit}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!res.isActive}
                      onClick={() => handleBook(res.id)}
                      className={cn(
                        'rounded-xl text-sm font-semibold px-4 py-2 transition-colors',
                        res.isActive
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      )}
                    >
                      {res.isActive ? 'Book Now' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      {/* Mobile sticky filter button */}
      <div className="sm:hidden fixed bottom-4 inset-x-4 z-20">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold shadow-lg hover:bg-slate-800"
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {/* Filter drawer/modal */}
      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-slate-900/40"
              onClick={() => setFilterOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed right-0 top-0 bottom-0 z-40 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">Filters</h3>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="rounded-full p-1 hover:bg-slate-100"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="flex-1 overflow-auto px-5 py-5 space-y-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Space type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                      const active = filters.category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() =>
                            setFilters((f) => ({ ...f, category: cat.id }))
                          }
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-sm font-medium',
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          )}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Location
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFilters((f) => ({ ...f, locationId: 'ALL' }))
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium',
                        filters.locationId === 'ALL'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      )}
                    >
                      All
                    </button>
                    {locations.map((loc) => {
                      const active = filters.locationId === loc.id;
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() =>
                            setFilters((f) => ({ ...f, locationId: loc.id }))
                          }
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-sm font-medium',
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          )}
                        >
                          {loc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Price range (₹)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm">
                      <span className="block text-xs text-slate-500">Min</span>
                      <input
                        type="number"
                        min={0}
                        value={filters.minPrice}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            minPrice: Number(e.target.value) || 0,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs text-slate-500">Max</span>
                      <input
                        type="number"
                        min={0}
                        value={filters.maxPrice}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            maxPrice: Number(e.target.value) || 0,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Range available: ₹{priceBounds.min.toLocaleString('en-IN')} – ₹
                    {priceBounds.max.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={filters.availableOnly}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, availableOnly: e.target.checked }))
                      }
                    />
                    Show only available
                  </label>
                </div>
              </div>
              <div className="border-t border-slate-200 px-5 py-4 flex gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Apply
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
