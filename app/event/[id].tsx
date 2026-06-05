import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, Icon, Text } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { ApiError, apiFetch } from '@/lib/api/client';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Guest = {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  vehicle_plate: string | null;
  visit_state: 'awaiting' | 'inside' | 'out' | 'upcoming' | 'expired' | 'cancelled';
  created_at: string;
};

type Event = {
  id: string;
  title: string;
  purpose: string;
  valid_from: string;
  valid_until: string;
  invite_url: string;
  invite_token: string;
  max_guests: number | null;
  notes: string | null;
  status: 'live' | 'upcoming' | 'ended' | 'revoked';
  guest_count: number;
  unit: { unit_number: string | null; property_name: string | null };
  guests: Guest[];
};

const STATE_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  awaiting: { bg: '#dcfce7', fg: '#15803d', label: 'Awaiting' },
  inside: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Inside' },
  out: { bg: '#f3f4f6', fg: '#6b7280', label: 'Visit complete' },
  upcoming: { bg: PRIMARY_TINT, fg: PRIMARY, label: 'Upcoming' },
  expired: { bg: '#f3f4f6', fg: '#6b7280', label: 'Expired' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c', label: 'Cancelled' },
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  live: { bg: '#dcfce7', fg: '#15803d' },
  upcoming: { bg: PRIMARY_TINT, fg: PRIMARY },
  ended: { bg: '#f3f4f6', fg: '#6b7280' },
  revoked: { bg: '#fee2e2', fg: '#b91c1c' },
};

export default function EventDetailScreen() {
  const router = useRouter();
  const { id, justCreated } = useLocalSearchParams<{ id: string; justCreated?: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/me/visitor-events/${id}`);
      setEvent(data.event);
    } catch {
      setEvent(null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleShare() {
    if (!event) return;
    // URL on its own line with no trailing punctuation — WhatsApp/Telegram/
    // SMS link parsers are most reliable when the URL is the only thing on
    // the line. (Some don't fully parse host:port/path URLs in dev — works
    // with a real https domain in production.)
    const text =
      `${event.title}\n` +
      `${new Date(event.valid_from).toLocaleString()} – ${new Date(event.valid_until).toLocaleString()}\n` +
      `${event.unit.property_name}, Unit ${event.unit.unit_number}\n` +
      `\n` +
      `Register here:\n` +
      `${event.invite_url}`;
    try {
      await Share.share({ message: text, url: event.invite_url });
    } catch {
      // user cancelled
    }
  }

  async function handleRevoke() {
    if (!event) return;
    Alert.alert(
      'Revoke this invite?',
      `Cancels all ${event.guest_count} registered guest passes. This can't be undone.`,
      [
        { text: 'Keep active', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevoking(true);
            try {
              const data = await apiFetch(`/api/v1/me/visitor-events/${id}/revoke`, { method: 'POST' });
              setEvent((prev) => prev ? { ...prev, ...data.event } : prev);
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Could not revoke.';
              Alert.alert('Failed', msg);
            }
            setRevoking(false);
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Event" />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!event) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Event" />
        <View style={styles.center}>
          <Text>Event not found.</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>Go back</Button>
        </View>
      </View>
    );
  }

  const statusMeta = STATUS_COLOR[event.status];
  const isAcceptingGuests = event.status === 'live'
    && (event.max_guests === null || event.guest_count < event.max_guests);

  return (
    <View style={styles.container}>
      <PurpleHeader title="Event" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {justCreated === '1' ? (
          <Card style={[styles.card, { backgroundColor: '#dcfce7' }]}>
            <Card.Content>
              <Text variant="titleSmall" style={{ color: '#15803d', fontWeight: '700' }}>
                ✓ Event created
              </Text>
              <Text variant="bodySmall" style={{ color: '#15803d', marginTop: 4 }}>
                Share the link below. Each person who fills the form gets their own pass.
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Text variant="headlineSmall" style={{ fontWeight: '700', flex: 1 }}>
                {event.title}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                <Text style={[styles.statusText, { color: statusMeta.fg }]}>{event.status}</Text>
              </View>
            </View>
            <Text variant="bodyMedium" style={{ opacity: 0.65, marginTop: 4 }}>
              {event.purpose.charAt(0).toUpperCase() + event.purpose.slice(1)} · Unit {event.unit.unit_number}
            </Text>
            <Text variant="bodySmall" style={{ opacity: 0.65, marginTop: 8 }}>
              {new Date(event.valid_from).toLocaleString()} → {new Date(event.valid_until).toLocaleString()}
            </Text>
            {event.notes ? (
              <Text variant="bodySmall" style={{ marginTop: 8, fontStyle: 'italic' }}>
                "{event.notes}"
              </Text>
            ) : null}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>Invite link</Text>
            <Text variant="bodySmall" style={styles.urlBox} numberOfLines={1} ellipsizeMode="middle">
              {event.invite_url}
            </Text>
            <Button
              mode="contained"
              icon="share-variant"
              onPress={handleShare}
              style={{ marginTop: 12 }}
              contentStyle={{ paddingVertical: 4 }}
              disabled={!isAcceptingGuests}>
              Share invite
            </Button>
            {!isAcceptingGuests ? (
              <Text variant="bodySmall" style={{ marginTop: 8, color: '#b91c1c' }}>
                {event.status === 'revoked' ? 'Invite revoked — no new registrations.' :
                 event.status === 'ended' ? 'Event ended.' :
                 event.status === 'upcoming' ? "Doesn't accept registrations until the event opens." :
                 'Reached max guest limit.'}
              </Text>
            ) : null}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Guests
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                {event.guest_count}{event.max_guests ? ` / ${event.max_guests}` : ''}
              </Text>
            </View>
            {event.guests.length === 0 ? (
              <Text variant="bodySmall" style={{ opacity: 0.5, marginTop: 6 }}>
                No registrations yet. Share the link to invite people.
              </Text>
            ) : (
              event.guests.map((g, i) => {
                const state = STATE_COLOR[g.visit_state];
                return (
                  <View key={g.id}>
                    {i > 0 ? <Divider style={{ marginVertical: 8 }} /> : null}
                    <View style={styles.guestRow}>
                      <View style={styles.guestIcon}>
                        <Icon source="account" size={20} color={PRIMARY} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{g.visitor_name}</Text>
                        <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                          {g.vehicle_plate ? `${g.vehicle_plate} · ` : ''}{g.visitor_phone ?? ''}
                        </Text>
                      </View>
                      <View style={[styles.statePill, { backgroundColor: state?.bg ?? '#f3f4f6' }]}>
                        <Text style={[styles.stateText, { color: state?.fg ?? '#6b7280' }]}>
                          {state?.label ?? g.visit_state}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>

        {event.status === 'live' || event.status === 'upcoming' ? (
          <Button
            mode="outlined"
            icon="link-off"
            onPress={handleRevoke}
            loading={revoking}
            textColor="#b91c1c"
            style={styles.action}
            contentStyle={{ paddingVertical: 4 }}>
            Revoke invite
          </Button>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  card: { marginBottom: 12 },
  sectionTitle: { fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  urlBox: { fontFamily: 'Menlo', backgroundColor: '#f3f4f6', padding: 8, borderRadius: 6, marginTop: 8 },

  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guestIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  statePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  stateText: { fontSize: 11, fontWeight: '600' },

  action: { marginTop: 12 },
});
