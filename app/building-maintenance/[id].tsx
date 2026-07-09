import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Icon, IconButton, Text } from 'react-native-paper';
import ImageView from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { apiFetch } from '@/lib/api/client';
import { TASK_STATUS, type BoardTask } from './index';

type Photo = { id: string; url: string };
type TaskUpdate = {
  id: string;
  note: string | null;
  status_change: string | null;
  created_at: string;
  photos: Photo[];
};
type TaskDetail = BoardTask & {
  description: string | null;
  updates: TaskUpdate[];
};

function groupByDate(updates: TaskUpdate[]): { label: string; items: TaskUpdate[] }[] {
  const sorted = [...updates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const groups: { label: string; items: TaskUpdate[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const u of sorted) {
    const day = new Date(u.created_at).toDateString();
    const label = day === today
      ? 'Today'
      : day === yesterday
        ? 'Yesterday'
        : new Date(u.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(u);
    } else {
      groups.push({ label, items: [u] });
    }
  }

  return groups;
}

export default function BoardTaskDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerPhotos, setViewerPhotos] = useState<Photo[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/me/maintenance-board/${id}`);
      setTask(data.task);
    } catch {
      setTask(null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openViewer(photos: Photo[], index: number) {
    setViewerPhotos(photos);
    setViewerIndex(index);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Maintenance" />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!task) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Maintenance" />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>Task not found.</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>Go back</Button>
        </View>
      </View>
    );
  }

  const s = TASK_STATUS[task.status] ?? TASK_STATUS.open;

  return (
    <View style={styles.container}>
      <PurpleHeader title="Maintenance" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
       <TabletContainer>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.titleRow}>
                <Text variant="titleLarge" style={styles.title}>{task.title}</Text>
                <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                  <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
                </View>
              </View>
              <Text variant="bodySmall" style={styles.meta}>
                {task.location ?? '—'}{task.category ? ` · ${task.category}` : ''}
              </Text>
              <Text variant="bodySmall" style={styles.meta}>
                Started {new Date(task.started_at).toLocaleDateString()}
                {task.completed_at
                  ? ` · Completed ${new Date(task.completed_at).toLocaleDateString()}`
                  : ''}
              </Text>
              {task.is_delayed ? (
                <View style={styles.delayedBadge}>
                  <Text style={styles.delayedText}>Behind schedule</Text>
                </View>
              ) : null}
              {task.description ? (
                <Text variant="bodyMedium" style={styles.body}>{task.description}</Text>
              ) : null}
            </Card.Content>
          </Card>

          <Text variant="titleSmall" style={styles.sectionTitle}>Progress updates</Text>
          {task.updates.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Icon source="timeline-clock-outline" size={36} color="#9ca3af" />
              <Text variant="bodySmall" style={styles.emptyText}>No updates posted yet.</Text>
            </View>
          ) : (
            groupByDate(task.updates).map((group) => (
              <View key={group.label}>
                <Text variant="bodySmall" style={styles.dateHeader}>{group.label}</Text>
                {group.items.map((u, i) => (
                  <View key={u.id} style={styles.timelineRow}>
                    {/* Rail lives OUTSIDE the card — dot + connecting line */}
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, {
                        backgroundColor: u.status_change
                          ? (TASK_STATUS[u.status_change]?.fg ?? '#9ca3af')
                          : '#c7c9d9',
                      }]} />
                      {i < group.items.length - 1 ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <Card style={styles.timelineCard}>
                      <Card.Content>
                        <Text variant="bodySmall" style={styles.updateTime}>
                          {new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {u.status_change ? (
                          <View style={styles.statusChangeRow}>
                            <Text variant="bodySmall" style={{ opacity: 0.65 }}>Status →</Text>
                            <View style={[styles.statusPill, {
                              backgroundColor: TASK_STATUS[u.status_change]?.bg ?? '#f3f4f6',
                            }]}>
                              <Text style={[styles.statusText, {
                                color: TASK_STATUS[u.status_change]?.fg ?? '#6b7280',
                              }]}>
                                {TASK_STATUS[u.status_change]?.label ?? u.status_change}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                        {u.note ? <Text variant="bodyMedium" style={styles.body}>{u.note}</Text> : null}
                        {u.photos.length > 0 ? (
                          <View style={styles.photoRow}>
                            {u.photos.map((p, i2) => (
                              <Pressable key={p.id} onPress={() => openViewer(u.photos, i2)} style={styles.photoItem}>
                                <Image source={{ uri: p.url }} style={styles.photoImg} />
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </Card.Content>
                    </Card>
                  </View>
                ))}
              </View>
            ))
          )}
       </TabletContainer>
      </ScrollView>

      {viewerPhotos ? (
        <ImageView
          images={viewerPhotos.map((p) => ({ uri: p.url }))}
          imageIndex={viewerIndex}
          visible
          onRequestClose={() => setViewerPhotos(null)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
          HeaderComponent={({ imageIndex }) => (
            <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
              <Text style={styles.viewerCount}>
                {imageIndex + 1} / {viewerPhotos.length}
              </Text>
              <IconButton
                icon="close"
                iconColor="#fff"
                size={24}
                onPress={() => setViewerPhotos(null)}
                style={{ margin: 0 }}
              />
            </View>
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16 },

  card: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontWeight: '700' },
  meta: { opacity: 0.65, marginTop: 4 },
  body: { lineHeight: 22, marginTop: 8 },

  sectionTitle: { fontWeight: '700', marginTop: 8, marginBottom: 8, textTransform: 'uppercase', fontSize: 12, opacity: 0.6 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },

  delayedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: '#fee2e2', marginTop: 8,
  },
  delayedText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },

  updateTime: { opacity: 0.55 },

  dateHeader: {
    fontWeight: '700', textTransform: 'uppercase', fontSize: 11,
    opacity: 0.55, marginBottom: 10, marginTop: 4,
  },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineLeft: { alignItems: 'center', width: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 18 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#e5e7eb', marginTop: 4 },
  timelineCard: { flex: 1, marginBottom: 12 },

  photoRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  photoItem: { width: 90, height: 90, borderRadius: 6, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  photoImg: { width: '100%', height: '100%' },

  emptyBlock: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { opacity: 0.6, textAlign: 'center' },

  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  viewerCount: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
