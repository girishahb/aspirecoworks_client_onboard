import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import {
  apiRequest,
  AuthUser,
  canSeeMoney,
  canWriteClients,
  clearSession,
  getStoredUser,
  login as apiLogin,
  notifyMailReceived,
} from './src/api';

type Screen = 'login' | 'home' | 'find' | 'new' | 'money' | 'detail';

type ClientCard = {
  id: string;
  companyName: string;
  contactPersonName?: string | null;
  contactPersonTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactPersonPhone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  taxId?: string | null;
  gstNumber?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  contractMonths?: number | null;
  membershipType?: string | null;
  officeType?: string | null;
  leadSource?: string | null;
  clientChannel?: string | null;
  aggregatorName?: string | null;
  externalBookingId?: string | null;
  onboardingStage?: string | null;
  renewalStatus?: string | null;
  renewalDate?: string | null;
  kycCompleted?: boolean | null;
  notes?: string | null;
  operationalStatus?: string;
  isActive?: boolean;
  payments?: { id: string; amount: number; status: string }[];
  invoices?: { id: string; invoiceNumber: string; totalAmount: number }[];
  location?: { name?: string; code?: string } | null;
  vendor?: { name?: string; code?: string } | null;
  rateCard?: { membershipType: string; rateExclusive: number; currency: string }[];
  applicableRate?: { membershipType: string; rateExclusive: number; currency: string } | null;
  legacyCharges?: number | null;
  legacyPaymentStatus?: string | null;
};

function DetailRow({ label, value }: { label: string; value?: string | number | null | boolean }) {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{display}</Text>
    </>
  );
}

type MetaLocation = { id: string; name: string; code: string | null };
type MetaVendor = { id: string; name: string; code: string };

function fmtDate(v?: string | null) {
  if (!v) return '—';
  return String(v).slice(0, 10);
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  if (!s) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function NavBack({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navBack, pressed && styles.navBackPressed]}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.navBackChevron}>‹</Text>
      <Text style={styles.navBackText}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientCard[]>([]);
  const [selected, setSelected] = useState<ClientCard | null>(null);

  const [locations, setLocations] = useState<MetaLocation[]>([]);
  const [vendors, setVendors] = useState<MetaVendor[]>([]);
  const [form, setForm] = useState({
    companyName: '',
    contactPersonName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    membershipType: '',
    officeType: 'Virtual',
    leadSource: 'Aggregator',
    contractMonths: '',
    locationId: '',
    vendorId: '',
    contractStartDate: '',
    contractEndDate: '',
    operationalStatus: 'UNKNOWN',
  });
  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);

  const [moneyTab, setMoneyTab] = useState<'payments' | 'invoices'>('payments');
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [mailPhotoUri, setMailPhotoUri] = useState<string | null>(null);
  const [mailPhotoBase64, setMailPhotoBase64] = useState<string | null>(null);
  const [mailPhotoMime, setMailPhotoMime] = useState('image/jpeg');
  const [mailNote, setMailNote] = useState('');
  const [mailSending, setMailSending] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getStoredUser();
      if (u) {
        setUser(u);
        setScreen('home');
      }
      setBooting(false);
    })();
  }, []);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      const u = await apiLogin(email.trim(), password);
      setUser(u);
      setScreen('home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await clearSession();
    setUser(null);
    setScreen('login');
  }

  async function runLookup() {
    if (query.trim().length < 2) {
      Alert.alert('Search', 'Enter at least 2 characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = await apiRequest<ClientCard[]>(
        `/mobile/clients/lookup?q=${encodeURIComponent(query.trim())}&limit=30`,
      );
      setResults(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id: string) {
    setBusy(true);
    try {
      const card = await apiRequest<ClientCard>(`/mobile/clients/${id}/status`);
      setSelected(card);
      setMailPhotoUri(null);
      setMailPhotoBase64(null);
      setMailPhotoMime('image/jpeg');
      setMailNote('');
      setScreen('detail');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setBusy(false);
    }
  }

  async function captureMailPhoto(fromLibrary = false) {
    const perm = fromLibrary
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        fromLibrary
          ? 'Allow photo library access to attach a mail image.'
          : 'Allow camera access to photograph incoming mail.',
      );
      return;
    }
    const result = fromLibrary
      ? await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.65,
          base64: true,
        })
      : await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.65,
          base64: true,
        });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Photo error', 'Could not read photo data. Please try again.');
        return;
      }
      setMailPhotoUri(asset.uri);
      setMailPhotoBase64(asset.base64);
      const mime =
        asset.mimeType ||
        (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      setMailPhotoMime(mime);
    }
  }

  async function sendMailNotify() {
    if (!selected) return;
    if (!mailPhotoBase64) {
      Alert.alert('Photo required', 'Take or choose a photo of the mail first.');
      return;
    }
    if (!selected.contactEmail?.trim()) {
      Alert.alert(
        'No email',
        'This client has no contact email. Ask staff to add one before sending.',
      );
      return;
    }
    setMailSending(true);
    try {
      const res = await notifyMailReceived(
        selected.id,
        mailPhotoBase64,
        mailPhotoMime,
        mailNote,
      );
      Alert.alert(
        'Email sent',
        `Sent to ${res.to}\nMail received: ${res.receivedAtIst}`,
      );
      setMailPhotoUri(null);
      setMailPhotoBase64(null);
      setMailNote('');
    } catch (e) {
      Alert.alert('Send failed', e instanceof Error ? e.message : 'Could not send email');
    } finally {
      setMailSending(false);
    }
  }

  async function loadMeta() {
    const locs = await apiRequest<MetaLocation[]>('/mobile/meta/locations');
    setLocations(locs);
    if (locs[0] && !form.locationId) {
      setForm((f) => ({ ...f, locationId: locs[0].id }));
      const vs = await apiRequest<MetaVendor[]>(`/mobile/meta/vendors?locationId=${locs[0].id}`);
      setVendors(vs);
    }
  }

  async function onLocationChange(locationId: string) {
    setForm((f) => ({ ...f, locationId, vendorId: '' }));
    const vs = await apiRequest<MetaVendor[]>(`/mobile/meta/vendors?locationId=${locationId}`);
    setVendors(vs);
  }

  async function openNewClient() {
    setScreen('new');
    setError(null);
    setDatePicker(null);
    try {
      await loadMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load locations');
    }
  }

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    const which = datePicker;
    if (Platform.OS === 'android') setDatePicker(null);
    if (event.type === 'dismissed' || !which || !selected) {
      if (Platform.OS === 'ios' && event.type === 'dismissed') setDatePicker(null);
      return;
    }
    const ymd = toYmd(selected);
    if (which === 'start') setForm((f) => ({ ...f, contractStartDate: ymd }));
    else setForm((f) => ({ ...f, contractEndDate: ymd }));
    if (Platform.OS === 'ios') setDatePicker(null);
  }

  async function submitNewClient() {
    if (!form.companyName.trim() || !form.locationId) {
      Alert.alert('Required', 'Company name and location are required');
      return;
    }
    const email = form.contactEmail.trim();
    if (!email) {
      Alert.alert('Required', 'Contact email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid email', 'Enter a valid contact email address');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: any = {
        companyName: form.companyName.trim(),
        contactEmail: email,
        locationId: form.locationId,
        operationalStatus: form.operationalStatus,
      };
      if (form.contactPersonName.trim()) body.contactPersonName = form.contactPersonName.trim();
      if (form.contactPhone.trim()) body.contactPhone = form.contactPhone.trim();
      if (form.address.trim()) body.address = form.address.trim();
      if (form.membershipType.trim()) body.membershipType = form.membershipType.trim();
      if (form.officeType.trim()) body.officeType = form.officeType.trim();
      if (form.leadSource.trim()) body.leadSource = form.leadSource.trim();
      if (form.contractMonths.trim()) {
        const n = Number(form.contractMonths);
        if (!Number.isFinite(n) || n <= 0) {
          Alert.alert('Contract months', 'Enter a positive number of months');
          setBusy(false);
          return;
        }
        body.contractMonths = Math.round(n);
      }
      if (form.vendorId) body.vendorId = form.vendorId;
      if (form.contractStartDate.trim()) body.contractStartDate = form.contractStartDate.trim();
      if (form.contractEndDate.trim()) body.contractEndDate = form.contractEndDate.trim();

      const created = await apiRequest<ClientCard>('/mobile/clients', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      Alert.alert('Created', created.companyName);
      setSelected(created);
      setScreen('detail');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function openMoney() {
    setScreen('money');
    setBusy(true);
    try {
      const [p, i] = await Promise.all([
        apiRequest<any>('/admin/payments?limit=30'),
        apiRequest<any>('/admin/invoices?limit=30'),
      ]);
      setPayments(Array.isArray(p) ? p : p?.data || []);
      setInvoices(Array.isArray(i) ? i : i?.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load money data');
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#134b7f" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen === 'login' && (
        <View style={styles.pad}>
          <Text style={styles.brand}>Aspire Coworks</Text>
          <Text style={styles.sub}>Mobile client ops</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.btn} onPress={handleLogin} disabled={busy}>
            <Text style={styles.btnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
          <Text style={styles.hint}>
            reception@ / Reception123! · staff@ / Staff123! · finance@ / Finance123!
          </Text>
        </View>
      )}

      {screen === 'home' && user && (
        <View style={styles.pad}>
          <Text style={styles.brand}>Hello, {user.firstName}</Text>
          <Text style={styles.sub}>Role: {user.role}</Text>
          <Pressable
            style={styles.btn}
            onPress={() => {
              setScreen('find');
              setResults([]);
              setError(null);
            }}
          >
            <Text style={styles.btnText}>Find client</Text>
          </Pressable>
          {canWriteClients(user.role) && (
            <Pressable style={styles.btnSecondary} onPress={openNewClient}>
              <Text style={styles.btnSecondaryText}>New client</Text>
            </Pressable>
          )}
          {canSeeMoney(user.role) && (
            <Pressable style={styles.btnSecondary} onPress={openMoney}>
              <Text style={styles.btnSecondaryText}>Payments & invoices</Text>
            </Pressable>
          )}
          <Pressable style={styles.linkBtn} onPress={handleLogout}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
      )}

      {screen === 'find' && (
        <View style={styles.flex}>
          <View style={styles.pad}>
            <NavBack label="Home" onPress={() => setScreen('home')} />
            <Text style={styles.h1}>Find client</Text>
            <TextInput
              style={styles.input}
              placeholder="Company, phone, name…"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={runLookup}
            />
            <Pressable style={styles.btn} onPress={runLookup} disabled={busy}>
              <Text style={styles.btnText}>{busy ? 'Searching…' : 'Search'}</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPad}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => openDetail(item.id)}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{item.companyName}</Text>
                  <Text style={item.isActive ? styles.badgeOk : styles.badgeBad}>
                    {item.isActive ? 'ACTIVE' : item.operationalStatus || 'INACTIVE'}
                  </Text>
                </View>
                <Text style={styles.muted}>{item.contactPersonName || '—'}</Text>
                <Text style={styles.muted}>{item.address || '—'}</Text>
                <Text style={styles.muted}>
                  {fmtDate(item.contractStartDate)} → {fmtDate(item.contractEndDate)}
                </Text>
                {canSeeMoney(user?.role || '') ? (
                  <Text style={[styles.muted, { marginTop: 4 }]}>
                    {item.vendor?.name ? `Vendor: ${item.vendor.name}` : 'Vendor: —'}
                    {item.applicableRate
                      ? ` · Rate: ₹${item.applicableRate.rateExclusive} (${item.applicableRate.membershipType})`
                      : item.rateCard?.length
                        ? ` · Rates: ${item.rateCard.map((r) => `${r.membershipType} ₹${r.rateExclusive}`).join(', ')}`
                        : ' · No rate card'}
                  </Text>
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.muted}>No results yet</Text>}
          />
        </View>
      )}

      {screen === 'detail' && selected && (
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <NavBack label="Back" onPress={() => setScreen('find')} />
          <Text style={styles.h1}>{selected.companyName}</Text>
          <Text style={selected.isActive ? styles.badgeOk : styles.badgeBad}>
            {selected.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Text>
          <Text style={styles.label}>Contact</Text>
          <Text style={styles.value}>{selected.contactPersonName || '—'}</Text>
          {selected.contactEmail ? (
            <>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{selected.contactEmail}</Text>
            </>
          ) : null}
          {selected.contactPhone ? (
            <>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{selected.contactPhone}</Text>
            </>
          ) : null}

          {user?.role === 'RECEPTION' ? (
            <View style={[styles.sectionCard, { marginTop: 16 }]}>
              <SectionTitle>Incoming mail</SectionTitle>
              <Text style={styles.muted}>
                Photograph mail and email the client. Received time is set when you tap Send.
              </Text>
              {!selected.contactEmail ? (
                <Text style={styles.error}>
                  No contact email on file — ask staff to add one before sending.
                </Text>
              ) : (
                <Text style={[styles.muted, { marginTop: 6 }]}>
                  Will send to {selected.contactEmail}
                </Text>
              )}
              {mailPhotoUri ? (
                <Image source={{ uri: mailPhotoUri }} style={styles.mailPreview} />
              ) : (
                <View style={styles.mailPreviewPlaceholder}>
                  <Text style={styles.muted}>No photo yet</Text>
                </View>
              )}
              <Pressable style={styles.btn} onPress={() => captureMailPhoto(false)}>
                <Text style={styles.btnText}>Take photo</Text>
              </Pressable>
              <Pressable
                style={[styles.btnSecondary, { marginTop: 10 }]}
                onPress={() => captureMailPhoto(true)}
              >
                <Text style={styles.btnSecondaryText}>Choose from gallery</Text>
              </Pressable>
              <FieldLabel>Note (optional)</FieldLabel>
              <TextInput
                style={styles.input}
                placeholder="e.g. Courier envelope, needs signature"
                value={mailNote}
                onChangeText={setMailNote}
              />
              <Pressable
                style={[styles.btn, (!mailPhotoBase64 || mailSending) && styles.btnDisabled]}
                onPress={sendMailNotify}
                disabled={!mailPhotoBase64 || mailSending || !selected.contactEmail}
              >
                <Text style={styles.btnText}>
                  {mailSending ? 'Sending…' : 'Send email to client'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <DetailRow label="Address" value={selected.address} />
          <Text style={styles.label}>Agreement</Text>
          <Text style={styles.value}>
            {fmtDate(selected.contractStartDate)} → {fmtDate(selected.contractEndDate)}
          </Text>
          <DetailRow label="Location" value={selected.location?.name} />
          <DetailRow label="Vendor" value={selected.vendor?.name} />
          <DetailRow label="Membership" value={selected.membershipType} />

          {canSeeMoney(user?.role || '') ? (
            <View style={[styles.sectionCard, { marginTop: 12, marginBottom: 8 }]}>
              <Text style={styles.sectionTitle}>Rate card (excl. GST)</Text>
              <Text style={styles.muted}>
                Vendor: {selected.vendor?.name || selected.vendor?.code || '—'}
              </Text>
              {selected.applicableRate ? (
                <Text style={[styles.value, { fontWeight: '700', marginTop: 8 }]}>
                  Applicable ({selected.applicableRate.membershipType}): ₹
                  {selected.applicableRate.rateExclusive}
                </Text>
              ) : selected.membershipType ? (
                <Text style={[styles.muted, { marginTop: 8 }]}>
                  No exact rate match for “{selected.membershipType}”
                </Text>
              ) : (
                <Text style={[styles.muted, { marginTop: 8 }]}>Client has no membership type</Text>
              )}
              {selected.rateCard?.length ? (
                selected.rateCard.map((r) => (
                  <Text key={r.membershipType} style={styles.value}>
                    {r.membershipType}: ₹{r.rateExclusive}
                  </Text>
                ))
              ) : (
                <Text style={styles.value}>No vendor rate card on file</Text>
              )}
              {selected.legacyCharges != null ? (
                <DetailRow label="Legacy charges" value={selected.legacyCharges} />
              ) : null}
              {selected.legacyPaymentStatus ? (
                <DetailRow label="Legacy payment status" value={selected.legacyPaymentStatus} />
              ) : null}
            </View>
          ) : null}

          <DetailRow label="Title" value={selected.contactPersonTitle} />
          <DetailRow label="Alt phone" value={selected.contactPersonPhone} />
          <DetailRow label="City" value={selected.city} />
          <DetailRow label="State" value={selected.state} />
          <DetailRow label="ZIP" value={selected.zipCode} />
          <DetailRow label="Country" value={selected.country} />
          <DetailRow label="PAN" value={selected.taxId} />
          <DetailRow label="GST" value={selected.gstNumber} />
          <DetailRow label="Office type" value={selected.officeType} />
          <DetailRow label="Lead source" value={selected.leadSource} />
          <DetailRow label="Channel" value={selected.clientChannel} />
          <DetailRow label="Aggregator" value={selected.aggregatorName} />
          <DetailRow label="Contract months" value={selected.contractMonths} />
          <DetailRow label="Booking ID" value={selected.externalBookingId} />
          <DetailRow label="Onboarding" value={selected.onboardingStage} />
          <DetailRow label="Renewal" value={selected.renewalStatus} />
          {selected.renewalDate ? (
            <DetailRow label="Renewal date" value={fmtDate(selected.renewalDate)} />
          ) : null}
          <DetailRow
            label="KYC"
            value={
              selected.kycCompleted === undefined || selected.kycCompleted === null
                ? null
                : selected.kycCompleted
            }
          />
          <DetailRow label="Notes" value={selected.notes} />

          {canSeeMoney(user?.role || '') && selected.payments?.length ? (
            <>
              <Text style={styles.label}>Recent payments</Text>
              {selected.payments.map((p) => (
                <Text key={p.id} style={styles.value}>
                  ₹{p.amount} · {p.status}
                </Text>
              ))}
            </>
          ) : null}
          {canSeeMoney(user?.role || '') && selected.invoices?.length ? (
            <>
              <Text style={styles.label}>Recent invoices</Text>
              {selected.invoices.map((inv) => (
                <Text key={inv.id} style={styles.value}>
                  {inv.invoiceNumber} · ₹{inv.totalAmount}
                </Text>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      {screen === 'new' && (
        <ScrollView contentContainerStyle={styles.formPad} keyboardShouldPersistTaps="handled">
          <NavBack label="Home" onPress={() => setScreen('home')} />
          <Text style={styles.h1}>New client</Text>

          <View style={styles.sectionCard}>
            <SectionTitle>Company</SectionTitle>
            <FieldLabel>Company name *</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="Company name"
              value={form.companyName}
              onChangeText={(t) => setForm((f) => ({ ...f, companyName: t }))}
            />
            <FieldLabel>Contact person</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="Contact person"
              value={form.contactPersonName}
              onChangeText={(t) => setForm((f) => ({ ...f, contactPersonName: t }))}
            />
            <FieldLabel>Contact email *</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="client@company.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={form.contactEmail}
              onChangeText={(t) => setForm((f) => ({ ...f, contactEmail: t }))}
            />
            <FieldLabel>Phone</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="Phone"
              keyboardType="phone-pad"
              value={form.contactPhone}
              onChangeText={(t) => setForm((f) => ({ ...f, contactPhone: t }))}
            />
            <FieldLabel>Address</FieldLabel>
            <TextInput
              style={[styles.input, styles.inputLast]}
              placeholder="Address"
              value={form.address}
              onChangeText={(t) => setForm((f) => ({ ...f, address: t }))}
            />
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle>Branch</SectionTitle>
            <FieldLabel>Location *</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={form.locationId} onValueChange={onLocationChange}>
                {locations.map((l) => (
                  <Picker.Item key={l.id} label={`${l.code || ''} — ${l.name}`} value={l.id} />
                ))}
              </Picker>
            </View>
            <FieldLabel>Vendor</FieldLabel>
            <View style={[styles.pickerWrap, styles.inputLast]}>
              <Picker
                selectedValue={form.vendorId}
                onValueChange={(v) => setForm((f) => ({ ...f, vendorId: v }))}
              >
                <Picker.Item label="(none)" value="" />
                {vendors.map((v) => (
                  <Picker.Item key={v.id} label={v.name} value={v.id} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle>Plan</SectionTitle>
            <FieldLabel>Office type</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={form.officeType}
                onValueChange={(v) => setForm((f) => ({ ...f, officeType: v }))}
              >
                <Picker.Item label="Virtual" value="Virtual" />
                <Picker.Item label="Physical" value="Physical" />
              </Picker>
            </View>
            <FieldLabel>Lead source</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={form.leadSource}
                onValueChange={(v) => setForm((f) => ({ ...f, leadSource: v }))}
              >
                <Picker.Item label="Aggregator" value="Aggregator" />
                <Picker.Item label="Direct" value="Direct" />
              </Picker>
            </View>
            <FieldLabel>Membership type</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={form.membershipType}
                onValueChange={(v) => setForm((f) => ({ ...f, membershipType: v }))}
              >
                <Picker.Item label="(none)" value="" />
                <Picker.Item label="GST Registration Plan (G.R)" value="GST Registration Plan (G.R)" />
                <Picker.Item label="Business Registration (B.R)" value="Business Registration (B.R)" />
                <Picker.Item label="Mailing Address (M.A)" value="Mailing Address (M.A)" />
              </Picker>
            </View>
            <FieldLabel>Contract months</FieldLabel>
            <TextInput
              style={[styles.input, styles.inputLast]}
              placeholder="e.g. 12"
              keyboardType="number-pad"
              value={form.contractMonths}
              onChangeText={(t) => setForm((f) => ({ ...f, contractMonths: t.replace(/[^\d]/g, '') }))}
            />
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle>Agreement</SectionTitle>
            <FieldLabel>Start date</FieldLabel>
            <Pressable
              style={styles.dateBtn}
              onPress={() => setDatePicker('start')}
              accessibilityRole="button"
              accessibilityLabel="Pick start date"
            >
              <Text style={form.contractStartDate ? styles.dateBtnText : styles.dateBtnPlaceholder}>
                {form.contractStartDate || 'Select start date'}
              </Text>
              <Text style={styles.dateBtnIcon}>Change</Text>
            </Pressable>
            <FieldLabel>End date</FieldLabel>
            <Pressable
              style={styles.dateBtn}
              onPress={() => setDatePicker('end')}
              accessibilityRole="button"
              accessibilityLabel="Pick end date"
            >
              <Text style={form.contractEndDate ? styles.dateBtnText : styles.dateBtnPlaceholder}>
                {form.contractEndDate || 'Select end date'}
              </Text>
              <Text style={styles.dateBtnIcon}>Change</Text>
            </Pressable>
            <FieldLabel>Status</FieldLabel>
            <View style={[styles.pickerWrap, styles.inputLast]}>
              <Picker
                selectedValue={form.operationalStatus}
                onValueChange={(v) => setForm((f) => ({ ...f, operationalStatus: v }))}
              >
                <Picker.Item label="Unknown" value="UNKNOWN" />
                <Picker.Item label="Active" value="ACTIVE" />
                <Picker.Item label="Inactive" value="INACTIVE" />
                <Picker.Item label="Pending" value="PENDING" />
              </Picker>
            </View>
          </View>

          {datePicker ? (
            <DateTimePicker
              value={parseYmd(datePicker === 'start' ? form.contractStartDate : form.contractEndDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.btn} onPress={submitNewClient} disabled={busy}>
            <Text style={styles.btnText}>{busy ? 'Saving…' : 'Create client'}</Text>
          </Pressable>
          <View style={{ height: 28 }} />
        </ScrollView>
      )}

      {screen === 'money' && (
        <View style={styles.flex}>
          <View style={styles.pad}>
            <NavBack label="Home" onPress={() => setScreen('home')} />
            <Text style={styles.h1}>Finance</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.chip, moneyTab === 'payments' && styles.chipOn]}
                onPress={() => setMoneyTab('payments')}
              >
                <Text>Payments</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, moneyTab === 'invoices' && styles.chipOn]}
                onPress={() => setMoneyTab('invoices')}
              >
                <Text>Invoices</Text>
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
          <FlatList
            data={moneyTab === 'payments' ? payments : invoices}
            keyExtractor={(item, idx) => item.id || String(idx)}
            contentContainerStyle={styles.listPad}
            renderItem={({ item }) => (
              <View style={styles.card}>
                {moneyTab === 'payments' ? (
                  <>
                    <Text style={styles.cardTitle}>
                      ₹{item.amount} · {item.status}
                    </Text>
                    <Text style={styles.muted}>
                      {item.clientProfile?.companyName || item.companyId || item.id}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardTitle}>
                      {item.invoiceNumber} · ₹{item.totalAmount}
                    </Text>
                    <Text style={styles.muted}>{item.billingName || item.companyId || item.id}</Text>
                  </>
                )}
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.muted}>{busy ? 'Loading…' : 'No records'}</Text>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef3f8' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 20 },
  formPad: { padding: 20, paddingBottom: 40 },
  listPad: { paddingHorizontal: 20, paddingBottom: 40 },
  brand: { fontSize: 28, fontWeight: '700', color: '#134b7f', marginBottom: 4 },
  sub: { color: '#64748b', marginBottom: 20 },
  h1: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: 4, marginBottom: 16 },
  navBack: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginLeft: -6,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e2ef',
  },
  navBackPressed: { backgroundColor: '#e8f0f8' },
  navBackChevron: { fontSize: 28, lineHeight: 30, color: '#134b7f', marginRight: 4, marginTop: -2 },
  navBackText: { fontSize: 17, fontWeight: '700', color: '#134b7f' },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#134b7f',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  inputLast: { marginBottom: 0 },
  dateBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateBtnText: { fontSize: 16, color: '#0f172a', fontWeight: '500' },
  dateBtnPlaceholder: { fontSize: 16, color: '#94a3b8' },
  dateBtnIcon: { fontSize: 14, fontWeight: '700', color: '#134b7f' },
  btn: {
    backgroundColor: '#134b7f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#134b7f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  btnSecondaryText: { color: '#134b7f', fontWeight: '700', fontSize: 16 },
  mailActionBtn: { flex: 1, marginTop: 10, paddingVertical: 12 },
  mailPreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#e2e8f0',
  },
  mailPreviewPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtn: { marginTop: 24, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  link: { color: '#0d9488', fontWeight: '600' },
  error: { color: '#b91c1c', marginBottom: 10, fontSize: 14 },
  hint: { marginTop: 16, color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, paddingRight: 8 },
  muted: { color: '#64748b', marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badgeOk: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  badgeBad: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  label: { marginTop: 12, color: '#64748b', fontSize: 12, fontWeight: '600' },
  value: { color: '#0f172a', fontSize: 16, marginTop: 2 },
  pickerWrap: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#99f6e4' },
});
