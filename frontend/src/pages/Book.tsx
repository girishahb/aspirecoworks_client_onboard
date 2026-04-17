import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getLocations,
  getPricing,
  createOrder,
  getRazorpayKeyId,
  type Location,
  type Resource,
  type TimeSlot,
  type PricingResponse,
} from '../services/bookings';
import { cn } from '../lib/utils';
import Toast from '../components/Toast';
import { MapPin, Users, Building2, ChevronRight, Check } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const STEPS = [
  { id: 1, label: 'Location' },
  { id: 2, label: 'Space' },
  { id: 3, label: 'Date' },
  { id: 4, label: 'Slot' },
  { id: 5, label: 'Details' },
  { id: 6, label: 'Payment' },
];

const RESOURCE_LABELS: Record<string, string> = {
  CONFERENCE_ROOM: 'Conference Room',
  DISCUSSION_ROOM: 'Discussion Room',
  DAY_PASS_DESK: 'Day Pass Desk',
};

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  CONFERENCE_ROOM: <Users className="w-6 h-6" />,
  DISCUSSION_ROOM: <Users className="w-6 h-6" />,
  DAY_PASS_DESK: <Building2 className="w-6 h-6" />,
};

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
      <div className="h-6 w-3/4 rounded bg-slate-200 mb-3" />
      <div className="h-4 w-full rounded bg-slate-100 mb-2" />
      <div className="h-4 w-2/3 rounded bg-slate-100" />
    </div>
  );
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Book() {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<Location | null>(null);
  const [resource, setResource] = useState<Resource | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        showToast(e instanceof Error ? e.message : 'Failed to load locations');
      })
      .finally(() => setLoading(false));
  }, [showToast]);

  const debouncedDate = useDebouncedValue(date, 300);
  useEffect(() => {
    if (!resource?.id || !debouncedDate) {
      setPricing(null);
      setSelectedSlots([]);
      return;
    }
    setPricingLoading(true);
    setPricing(null);
    setSelectedSlots([]);
    const dateStr = debouncedDate.toISOString().slice(0, 10);
    getPricing(resource.id, dateStr)
      .then((p) => {
        setPricing(p);
        if (p.availableSlots?.length === 1) setSelectedSlots([p.availableSlots[0]]);
      })
      .catch(() => {
        setPricing(null);
        setSelectedSlots([]);
        showToast('Failed to load availability');
      })
      .finally(() => setPricingLoading(false));
  }, [resource?.id, debouncedDate, showToast]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isDesk = resource?.type === 'DAY_PASS_DESK';
  const effectiveSlots = selectedSlots.length > 0
    ? selectedSlots
    : isDesk && pricing?.availableSlots?.[0]
      ? [pricing.availableSlots[0]]
      : [];
  const amount =
    pricing && effectiveSlots.length > 0
      ? isDesk
        ? (pricing.pricing?.dayPrice ?? 0) * quantity
        : (pricing.pricing?.hourlyPrice ?? 0) * effectiveSlots.length
      : 0;

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPhone = /^\d{10}$/.test(phone.replace(/\s/g, ''));
  const validName = name.trim().length >= 2;
  const validDetails = validName && validEmail && validPhone;

  const goNext = useCallback(() => {
    if (step < 6) {
      setStep(step + 1);
      requestAnimationFrame(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 1) setStep(step - 1);
  }, [step]);

  const handleSelectLocation = useCallback(
    (loc: Location) => {
      setLocation(loc);
      setResource(null);
      setDate(undefined);
      setPricing(null);
      setSelectedSlots([]);
      goNext();
    },
    [goNext]
  );

  const handleSelectResource = useCallback(
    (res: Resource) => {
      if (!res.isActive) return;
      setResource(res);
      setDate(undefined);
      setPricing(null);
      setSelectedSlots([]);
      goNext();
    },
    [goNext]
  );

  const handleDateSelect = useCallback(
    (d: Date | undefined) => {
      setDate(d);
      setSelectedSlots([]);
    },
    []
  );

  const handleSlotSelect = useCallback(
    (slot: TimeSlot) => {
      setSelectedSlots((prev) => {
        const inList = prev.some((s) => s.id === slot.id);
        if (inList) return prev.filter((s) => s.id !== slot.id);
        if (isDesk) return [slot];
        return [...prev, slot];
      });
    },
    [isDesk]
  );

  const handlePayment = useCallback(async () => {
    if (!resource || !date || !validDetails || effectiveSlots.length === 0) return;
    setSubmitting(true);
    try {
      const { requiresPayment, orderId, amount: orderAmount } = await createOrder({
        resourceId: resource.id,
        date: date.toISOString().slice(0, 10),
        timeSlotIds: effectiveSlots.map((s) => s.id),
        quantity: isDesk ? quantity : 1,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim().replace(/\s/g, ''),
        couponCode: couponCode.trim() || undefined,
      });

      const timeSlotText =
        effectiveSlots.length === 1
          ? `${effectiveSlots[0].startTime} – ${effectiveSlots[0].endTime}`
          : effectiveSlots
              .map((s) => `${s.startTime}–${s.endTime}`)
              .join(', ');

      if (!requiresPayment) {
        navigate('/booking-success', {
          state: {
            resourceType: resource.type,
            locationName: location?.name,
            date: date.toISOString().slice(0, 10),
            timeSlot: timeSlotText,
            quantity: isDesk ? quantity : 1,
            amount: orderAmount,
          },
        });
        return;
      }

      let keyId = import.meta.env.VITE_RAZORPAY_KEY_ID ?? import.meta.env.VITE_RAZORPAY_KEY;
      if (!keyId) {
        keyId = await getRazorpayKeyId();
      }
      if (!keyId) {
        showToast('Razorpay not configured');
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay'));
      });

      const rzp = new window.Razorpay({
        key: keyId,
        amount: Math.round(orderAmount * 100),
        currency: 'INR',
        order_id: orderId ?? undefined,
        name: 'Aspire Coworks',
        description: 'Workspace Booking',
        prefill: { name: name.trim(), email: email.trim(), contact: phone.trim() },
        handler: () => {
          navigate('/booking-success', {
            state: {
              resourceType: resource.type,
              locationName: location?.name,
              date: date.toISOString().slice(0, 10),
              timeSlot: timeSlotText,
              quantity: isDesk ? quantity : 1,
              amount: orderAmount,
            },
          });
        },
      });
      rzp.on('payment.failed', () => {
        showToast('Payment failed. Please try again.');
        setSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  }, [resource, date, validDetails, effectiveSlots, quantity, name, email, phone, couponCode, location?.name, navigate, showToast]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-5xl">
          <div className="h-10 w-56 rounded-lg bg-slate-200 animate-pulse mb-4" />
          <div className="h-5 w-72 rounded bg-slate-100 animate-pulse mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && locations.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-800 shadow-sm max-w-md text-center">
          <p className="font-medium">{error}</p>
          <p className="mt-2 text-sm">Please try again later.</p>
        </div>
      </div>
    );
  }

  const resources = location?.resources ?? [];

  return (
    <div
      className={cn(
        'min-h-[70vh] bg-white py-8 px-4 sm:py-12',
        step >= 3 && step <= 5 && 'pb-24 lg:pb-8'
      )}
    >
      <AnimatePresence>
        {toast && (
          <Toast key={toast} message={toast} type="error" onDismiss={() => setToast(null)} />
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Book Your Space
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Premium coworking at Aspire Coworks
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-10">
          {/* Mobile: current step label so it's always visible without scrolling */}
          <p className="sm:hidden text-center text-sm font-medium text-slate-600 mb-3">
            Step {step} of {STEPS.length}: {STEPS[step - 1]?.label}
          </p>
          <div className="flex items-center gap-1 sm:gap-2 sm:justify-between overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className="flex flex-1 sm:flex-initial items-center flex-shrink-0 min-w-[52px] sm:min-w-0"
              >
                <div className="flex flex-col items-center w-full min-w-[52px] sm:min-w-0 flex-1">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all',
                      step > s.id
                        ? 'bg-indigo-600 text-white'
                        : step === s.id
                          ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                          : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {step > s.id ? (
                      <Check className="h-5 w-5" strokeWidth={3} />
                    ) : (
                      s.id
                    )}
                  </div>
                  <span
                    className={cn(
                      'mt-2 text-xs font-medium w-full text-center whitespace-nowrap',
                      step >= s.id ? 'text-slate-900' : 'text-slate-400'
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 mx-0.5 sm:mx-1 min-w-[6px] sm:min-w-[8px] rounded flex-shrink-0 hidden sm:block',
                      step > s.id ? 'bg-indigo-600' : 'bg-slate-200'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-2px_rgba(0,0,0,0.05)]"
            >
              {/* Step 1: Location */}
              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {locations.map((loc) => (
                    <motion.button
                      key={loc.id}
                      type="button"
                      whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.1)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectLocation(loc)}
                      className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      <MapPin className="w-8 h-8 text-indigo-600 mb-3" />
                      <h3 className="font-semibold text-slate-900 text-lg">{loc.name}</h3>
                      <p className="mt-1 text-sm text-slate-500 line-clamp-2">{loc.address}</p>
                      <span className="mt-3 inline-flex items-center text-sm font-medium text-indigo-600">
                        View Spaces
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Step 2: Resource */}
              {step === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(['CONFERENCE_ROOM', 'DISCUSSION_ROOM', 'DAY_PASS_DESK'] as const).map((type) => {
                    const res = resources.find((r) => r.type === type);
                    if (!res) return null;
                    const price = res.pricing?.dayPrice ?? res.pricing?.hourlyPrice ?? 0;
                    const inactive = (res as { isActive?: boolean }).isActive === false;
                    return (
                      <motion.button
                        key={res.id}
                        type="button"
                        whileHover={!inactive ? { y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.1)' } : {}}
                        whileTap={!inactive ? { scale: 0.98 } : {}}
                        onClick={() => !inactive && handleSelectResource(res)}
                        disabled={inactive}
                        className={cn(
                          'rounded-2xl border-2 bg-white p-6 text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                          inactive
                            ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                            : 'border-slate-200 hover:border-indigo-300'
                        )}
                      >
                        <div className={cn('mb-3', inactive ? 'text-slate-400' : 'text-indigo-600')}>
                          {RESOURCE_ICONS[type]}
                        </div>
                        <h3 className="font-semibold text-slate-900 text-lg">
                          {RESOURCE_LABELS[type]}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-indigo-600">
                          From ₹{price.toLocaleString('en-IN')}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Capacity: {res.capacity}
                        </p>
                        {!inactive && (
                          <span className="mt-3 inline-flex items-center text-sm font-medium text-indigo-600">
                            Select
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Step 3: Date */}
              {step === 3 && (
                <div>
                  <DayPicker
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    disabled={{ before: today }}
                    className="rdp-indigo rounded-xl border border-slate-200 p-4 mx-auto [&_.rdp-day_selected]:bg-indigo-600 [&_.rdp-day_selected]:text-white [&_.rdp-day:hover:not(.rdp-day_selected)]:bg-indigo-50 [&_.rdp-day]:rounded-lg [&_.rdp-day_today]:font-semibold"
                  />
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!date}
                    className={cn(
                      'mt-6 w-full py-3 rounded-xl font-semibold transition-colors',
                      date ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Step 4: Time Slot */}
              {step === 4 && (
                <div>
                  {isDesk && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Number of desks
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={resource?.capacity ?? 1}
                        value={quantity}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10) || 1;
                          setQuantity(Math.max(1, Math.min(resource?.capacity ?? 1, v)));
                        }}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}
                  {pricingLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  ) : !pricing?.availableSlots?.length && !pricing?.slotAvailability?.length ? (
                    <p className="text-amber-600 py-4">No slots available for this date.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(pricing?.slotAvailability?.length
                        ? pricing.slotAvailability.map((sa) => ({
                            id: sa.slotId,
                            startTime: sa.startTime,
                            endTime: sa.endTime,
                            isFullDay: isDesk,
                            isActive: true,
                            remaining: sa.remaining,
                            isFull: sa.isFull,
                          }))
                        : pricing?.availableSlots?.map((s) => ({
                            ...s,
                            remaining: isDesk ? (pricing?.remainingCapacity ?? null) : null,
                            isFull: false,
                          })) ?? []
                      ).map((slot) => {
                        const isFull = 'isFull' in slot && slot.isFull;
                        const remaining = 'remaining' in slot ? slot.remaining : null;
                        const isSelected = selectedSlots.some((s) => s.id === slot.id);
                        const slotForSelect = {
                          id: slot.id,
                          startTime: slot.startTime,
                          endTime: slot.endTime,
                          isFullDay: isDesk,
                          isActive: true,
                        };
                        return (
                          <motion.button
                            key={slot.id}
                            type="button"
                            whileTap={isFull ? undefined : { scale: 0.98 }}
                            onClick={() => !isFull && handleSlotSelect(slotForSelect)}
                            disabled={isFull}
                            className={cn(
                              'py-3 rounded-xl font-medium text-sm transition-all',
                              isFull &&
                                'cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200',
                              !isFull &&
                                (isSelected
                                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2'
                                  : 'border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50')
                            )}
                          >
                            {slot.startTime} – {slot.endTime}
                            {isFull && (
                              <span className="block text-xs mt-1 font-medium">Full</span>
                            )}
                            {!isFull &&
                              remaining != null &&
                              remaining > 0 &&
                              remaining < 3 && (
                                <span className="block text-xs mt-1 opacity-80">
                                  Only {remaining} left
                                </span>
                              )}
                            {isDesk && !isFull && pricing?.remainingCapacity != null && remaining == null && (
                              <span className="block text-xs mt-1 opacity-80">
                                {pricing.remainingCapacity} left
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                  {!isDesk && selectedSlots.length > 0 && (
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedSlots.length} slot{selectedSlots.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={effectiveSlots.length === 0 || pricingLoading}
                    className={cn(
                      'mt-6 w-full py-3 rounded-xl font-semibold transition-colors',
                      effectiveSlots.length > 0 && !pricingLoading
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Step 5: Details */}
              {step === 5 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setNameTouched(true)}
                      placeholder="Enter your full name"
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500',
                        nameTouched && !validName ? 'border-red-300' : 'border-slate-300'
                      )}
                    />
                    {nameTouched && !validName && (
                      <p className="mt-1 text-sm text-red-600">Name must be at least 2 characters</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      placeholder="you@example.com"
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500',
                        emailTouched && !validEmail ? 'border-red-300' : 'border-slate-300'
                      )}
                    />
                    {emailTouched && !validEmail && (
                      <p className="mt-1 text-sm text-red-600">Enter a valid email address</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={() => setPhoneTouched(true)}
                      placeholder="10 digit number"
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500',
                        phoneTouched && !validPhone ? 'border-red-300' : 'border-slate-300'
                      )}
                    />
                    {phoneTouched && !validPhone && (
                      <p className="mt-1 text-sm text-red-600">Enter a valid 10-digit phone number</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!validDetails}
                    className={cn(
                      'mt-6 w-full py-3 rounded-xl font-semibold transition-colors',
                      validDetails
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    Continue to Payment
                  </button>
                </div>
              )}

              {/* Step 6: Payment */}
              {step === 6 && (
                <div className="space-y-6">
                  <p className="text-slate-600">
                    Review your booking and proceed to pay securely via Razorpay.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Internal Coupon Code (optional)
                    </label>
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code for internal booking"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      If valid, payment may be skipped for internal bookings.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex-1 py-3 rounded-xl font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handlePayment}
                      disabled={submitting}
                      className="flex-1 py-3 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? 'Processing...' : couponCode.trim() ? 'Apply Coupon & Continue' : 'Proceed to Pay'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Price Summary (sticky) */}
          {(step >= 4 || (step === 3 && date)) && (
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Booking Summary</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Location</dt>
                      <dd className="font-medium text-slate-900">{location?.name ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Resource</dt>
                      <dd className="font-medium text-slate-900">
                        {resource ? RESOURCE_LABELS[resource.type] : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Date</dt>
                      <dd className="font-medium text-slate-900">
                        {date
                          ? date.toLocaleDateString('en-IN', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Time Slot</dt>
                      <dd className="font-medium text-slate-900 text-right max-w-[60%]">
                        {effectiveSlots.length > 0
                          ? effectiveSlots.length === 1
                            ? `${effectiveSlots[0].startTime} – ${effectiveSlots[0].endTime}`
                            : effectiveSlots
                                .map((s) => `${s.startTime}–${s.endTime}`)
                                .join(', ')
                          : '—'}
                      </dd>
                    </div>
                    {isDesk && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Quantity</dt>
                        <dd className="font-medium text-slate-900">{quantity}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600">Total</span>
                      <span className="text-2xl font-bold text-indigo-600">
                        ₹{amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
        </div>

        {/* Back button */}
        {step > 1 && step < 6 && (
          <button
            type="button"
            onClick={goBack}
            className="mt-6 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back
          </button>
        )}

        {/* Mobile fixed bottom button - steps 3–5 only (1–2 advance via card tap) */}
        {step >= 3 && step <= 5 && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] safe-area-pb">
            <button
              type="button"
              onClick={goNext}
              disabled={
                (step === 3 && !date) ||
                (step === 4 && (effectiveSlots.length === 0 || pricingLoading)) ||
                (step === 5 && !validDetails)
              }
              className={cn(
                'w-full py-3 rounded-xl font-semibold transition-colors',
                (step === 3 && date) ||
                  (step === 4 && effectiveSlots.length > 0 && !pricingLoading) ||
                  (step === 5 && validDetails)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              {step === 5 ? 'Continue to Payment' : 'Proceed'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
