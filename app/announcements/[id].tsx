import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Icon, IconButton, Text } from 'react-native-paper';
import ImageView from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { apiFetch } from '@/lib/api/client';

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

export default function AnnouncementDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/announcements/${id}`);
      setItem(data.announcement);
    } catch {
      setItem(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('announcements.announcement')} />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!item) {
    return (
      <View style={styles.container}>
        <PurpleHeader title={t('announcements.announcement')} />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>{t('announcements.notFound')}</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>{t('common.goBack')}</Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title={t('announcements.announcement')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Card.Content>
            {item.pinned ? (
              <View style={styles.pinPill}>
                <Text style={styles.pinText}>{t('announcements.pinned')}</Text>
              </View>
            ) : null}
            <Text variant="headlineSmall" style={styles.title}>{item.title}</Text>
            <Text variant="bodySmall" style={styles.meta}>
              {new Date(item.published_at).toLocaleString()} · {item.author.name ?? '—'}
            </Text>
            {item.organization.legal_name ? (
              <Text variant="bodySmall" style={styles.meta}>
                {item.organization.legal_name}
              </Text>
            ) : null}

            <Text variant="bodyLarge" style={styles.body}>{item.body}</Text>
          </Card.Content>
        </Card>

        {item.photos.length > 0 ? (
          <View style={styles.photosBlock}>
            <Text variant="bodySmall" style={styles.photoHint}>
              {t('announcements.photoCountTap', { count: item.photos.length })}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}>
              {item.photos.map((p, i) => (
                <Pressable
                  key={p.id}
                  onPress={() => setViewerIndex(i)}
                  style={styles.thumbWrap}>
                  <Image source={{ uri: p.url }} style={styles.thumb} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <ImageView
        images={item.photos.map((p) => ({ uri: p.url }))}
        imageIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onRequestClose={() => setViewerIndex(null)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        // Override the lib's default header so we don't trigger the
        // deprecated-SafeAreaView warning that ships inside the package.
        HeaderComponent={({ imageIndex }) => (
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.viewerCount}>
              {imageIndex + 1} / {item.photos.length}
            </Text>
            <IconButton
              icon="close"
              iconColor="#fff"
              size={24}
              onPress={() => setViewerIndex(null)}
              style={{ margin: 0 }}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  card: { marginBottom: 16 },
  pinPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: PRIMARY_TINT,
    marginBottom: 6,
  },
  pinText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  title: { fontWeight: '700', marginTop: 2 },
  meta: { opacity: 0.55, marginTop: 4 },
  body: { marginTop: 16, lineHeight: 24 },

  photosBlock: { marginTop: 4 },
  photoHint: { opacity: 0.55, marginBottom: 8 },
  photoStrip: { gap: 8, paddingRight: 8 },
  thumbWrap: {
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  thumb: { width: '100%', height: '100%' },

  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  viewerCount: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
