import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Icon, Text } from 'react-native-paper';

import { PurpleHeader } from '@/components/purple-header';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published_at: string;
  author: { name: string | null };
  organization: { legal_name: string | null };
  photos: { id: string; url: string }[];
};

export default function AnnouncementsListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/announcements');
      setItems(data.announcements ?? []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, []);

  // On focus: load + mark all read so the unread badge clears.
  useFocusEffect(
    useCallback(() => {
      load();
      (async () => {
        try {
          await apiFetch('/api/v1/announcements/mark-all-read', { method: 'POST' });
          await refreshUser();
        } catch {
          // not critical
        }
      })();
    }, [load, refreshUser]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title={t('announcements.title')} />
      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Icon source="speakerphone" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={{ marginTop: 12, opacity: 0.65, textAlign: 'center', paddingHorizontal: 32 }}>
            {t('announcements.noAnnouncements')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: item.id } })}>
              <Card.Content>
                <View style={styles.titleRow}>
                  {item.pinned ? (
                    <View style={styles.pinPill}>
                      <Text style={styles.pinText}>{t('announcements.pinned')}</Text>
                    </View>
                  ) : null}
                  {item.organization?.legal_name ? (
                    <View style={styles.jmbBadge}>
                      <Icon source="city-variant-outline" size={11} color="#6b7280" />
                      <Text style={styles.jmbBadgeText} numberOfLines={1}>
                        {item.organization.legal_name}
                      </Text>
                    </View>
                  ) : null}
                  <Text variant="titleMedium" style={styles.title}>{item.title}</Text>
                </View>
                <Text variant="bodySmall" style={styles.meta}>
                  {new Date(item.published_at).toLocaleString()} · {item.author.name ?? '—'}
                </Text>
                <Text variant="bodyMedium" style={styles.bodyPreview} numberOfLines={3}>
                  {item.body}
                </Text>
                {item.photos.length > 0 ? (
                  <View style={styles.photoStrip}>
                    <Icon source="image-multiple" size={16} color={PRIMARY} />
                    <Text variant="bodySmall" style={{ color: PRIMARY, marginLeft: 4 }}>
                      {t('announcements.photoCount', { count: item.photos.length })}
                    </Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16 },
  card: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontWeight: '600', flex: 1, minWidth: 0 },
  pinPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: PRIMARY_TINT,
  },
  pinText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  jmbBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, backgroundColor: '#f3f4f6',
    maxWidth: '70%',
  },
  jmbBadgeText: { fontSize: 11, color: '#374151', fontWeight: '500' },
  meta: { opacity: 0.55, marginTop: 4 },
  bodyPreview: { marginTop: 8, opacity: 0.85, lineHeight: 20 },
  photoStrip: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
});
