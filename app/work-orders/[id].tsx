import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Card, Icon, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoSourceSheet } from '@/components/photo-source-sheet';
import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { ApiError, apiFetch } from '@/lib/api/client';
import { getToken } from '@/lib/auth/storage';
import { WO_PRIORITY, WO_STATUS, type WorkOrder } from './index';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8123';

type Photo = { id: string; url: string };
type WoUpdate = {
  id: string;
  note: string | null;
  status_change: string | null;
  is_internal: boolean;
  author_name: string | null;
  created_at: string;
  photos: Photo[];
};
type WorkOrderDetail = WorkOrder & {
  description: string | null;
  allowed_transitions: string[];
  updates: WoUpdate[];
};

const TRANSITION_LABEL: Record<string, string> = {
  in_progress: 'Start work',
  on_hold: 'Put on hold',
  completed: 'Mark completed',
};

export default function WorkOrderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wo, setWo] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [note, setNote] = useState('');
  const [statusChange, setStatusChange] = useState<string | null>(null);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/me/work-orders/${id}`);
      setWo(data.task);
    } catch {
      setWo(null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera disabled', 'Allow camera access in Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets) {
      setImages([...images, ...result.assets].slice(0, 5));
    }
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 5 - images.length,
    });
    if (!result.canceled && result.assets) {
      setImages([...images, ...result.assets].slice(0, 5));
    }
  }

  async function handlePost() {
    if (!wo) return;
    setPosting(true);
    try {
      const formData = new FormData();
      if (note.trim()) formData.append('note', note.trim());
      if (statusChange) formData.append('status_change', statusChange);
      images.forEach((img, i) => {
        const name = img.fileName ?? `photo-${i}.jpg`;
        const type = img.mimeType ?? 'image/jpeg';
        // @ts-expect-error — RN FormData accepts {uri, name, type}
        formData.append('photos[]', { uri: img.uri, name, type });
      });

      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/v1/me/work-orders/${wo.id}/updates`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, json, json?.message);

      setNote('');
      setStatusChange(null);
      setImages([]);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const first = Object.values(err.body?.errors ?? {})[0] as string[] | undefined;
        Alert.alert('Could not post', first?.[0] ?? 'Add a note, status, or photo.');
      } else {
        Alert.alert('Could not post', 'Check your connection and try again.');
      }
    }
    setPosting(false);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Work Order" />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!wo) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Work Order" />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>Work order not found.</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>Go back</Button>
        </View>
      </View>
    );
  }

  const s = WO_STATUS[wo.status] ?? WO_STATUS.assigned;
  const p = WO_PRIORITY[wo.priority] ?? WO_PRIORITY.normal;
  const canPost = wo.status !== 'completed' && wo.status !== 'closed';
  const submitDisabled = posting || (!note.trim() && !statusChange && images.length === 0);

  return (
    <View style={styles.container}>
      <PurpleHeader title="Work Order" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled">
         <TabletContainer>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.jmbRow}>
                <View style={styles.jmbBadge}>
                  <Text style={styles.jmbBadgeText}>{wo.organization.legal_name ?? '—'}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                  <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
                </View>
              </View>
              <Text variant="titleLarge" style={styles.title}>{wo.title}</Text>
              <Text variant="bodySmall" style={styles.meta}>
                {wo.location ?? '—'}
                {wo.unit_number ? ` · Unit ${wo.unit_number}` : ''}
                {wo.category ? ` · ${wo.category}` : ''}
              </Text>
              <Text variant="bodySmall" style={[styles.meta, { color: p.fg }]}>
                Priority: {p.label}
                {wo.due_date ? ` · Due ${new Date(wo.due_date).toLocaleDateString()}` : ''}
              </Text>
              {wo.description ? (
                <Text variant="bodyMedium" style={styles.body}>{wo.description}</Text>
              ) : null}
            </Card.Content>
          </Card>

          {/* Compose — note / photos / status move */}
          {canPost ? (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 8 }}>Post update</Text>

                {wo.allowed_transitions.length > 0 ? (
                  <View style={styles.transitionRow}>
                    {wo.allowed_transitions.map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setStatusChange(statusChange === t ? null : t)}
                        style={[styles.transitionChip, statusChange === t && styles.transitionChipActive]}>
                        <Text style={[styles.transitionText, statusChange === t && styles.transitionTextActive]}>
                          {TRANSITION_LABEL[t] ?? t}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <TextInput
                  value={note}
                  onChangeText={setNote}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  placeholder="e.g. Replaced the capacitor, testing now"
                  maxLength={5000}
                  style={{ marginBottom: 8 }}
                  contentStyle={{ paddingTop: 12, paddingBottom: 12 }}
                />

                <View style={styles.photoRow}>
                  {images.map((img) => (
                    <View key={img.uri} style={styles.photoThumb}>
                      <Image source={{ uri: img.uri }} style={styles.photoImg} />
                      <Pressable style={styles.removeBtn} onPress={() => setImages(images.filter((a) => a.uri !== img.uri))}>
                        <Icon source="close" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {images.length < 5 ? (
                    <Pressable style={styles.addPhotoBtn} onPress={() => setSheetOpen(true)}>
                      <Icon source="camera-plus" size={22} color={PRIMARY} />
                    </Pressable>
                  ) : null}
                </View>

                <Button
                  mode="contained"
                  onPress={handlePost}
                  loading={posting}
                  disabled={submitDisabled}
                  style={{ marginTop: 12 }}>
                  {statusChange ? TRANSITION_LABEL[statusChange] ?? 'Post update' : 'Post update'}
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <View style={styles.doneNotice}>
              <Icon source="check-circle-outline" size={16} color="#15803d" />
              <Text variant="bodySmall" style={styles.doneNoticeText}>
                This work order is {wo.status}. The office takes it from here.
              </Text>
            </View>
          )}

          <Text variant="titleSmall" style={styles.sectionTitle}>History</Text>
          {wo.updates.length === 0 ? (
            <Text variant="bodySmall" style={{ opacity: 0.6, textAlign: 'center', paddingVertical: 16 }}>
              No updates yet.
            </Text>
          ) : (
            wo.updates.map((u) => (
              <Card key={u.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.updateHeader}>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{u.author_name ?? '—'}</Text>
                    <Text variant="bodySmall" style={{ opacity: 0.55 }}>
                      {new Date(u.created_at).toLocaleString()}
                    </Text>
                  </View>
                  {u.status_change ? (
                    <View style={styles.statusChangeRow}>
                      <Text variant="bodySmall" style={{ opacity: 0.65 }}>Status →</Text>
                      <View style={[styles.statusPill, { backgroundColor: WO_STATUS[u.status_change]?.bg ?? '#f3f4f6' }]}>
                        <Text style={[styles.statusText, { color: WO_STATUS[u.status_change]?.fg ?? '#6b7280' }]}>
                          {WO_STATUS[u.status_change]?.label ?? u.status_change}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {u.note ? <Text variant="bodyMedium" style={styles.body}>{u.note}</Text> : null}
                  {u.photos.length > 0 ? (
                    <View style={styles.photoRow}>
                      {u.photos.map((ph) => (
                        <Image key={ph.id} source={{ uri: ph.url }} style={styles.photoImg} />
                      ))}
                    </View>
                  ) : null}
                </Card.Content>
              </Card>
            ))
          )}
         </TabletContainer>
        </ScrollView>
      </KeyboardAvoidingView>

      <PhotoSourceSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onTakePhoto={takePhoto}
        onPickFromLibrary={pickFromLibrary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16 },

  card: { marginBottom: 12 },
  jmbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  jmbBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: PRIMARY_TINT, maxWidth: '60%',
  },
  jmbBadgeText: { color: PRIMARY, fontSize: 11, fontWeight: '700' },

  title: { fontWeight: '700' },
  meta: { opacity: 0.65, marginTop: 4 },
  body: { lineHeight: 22, marginTop: 8 },

  sectionTitle: { fontWeight: '700', marginTop: 8, marginBottom: 8, textTransform: 'uppercase', fontSize: 12, opacity: 0.6 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },

  transitionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  transitionChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: 'transparent',
  },
  transitionChipActive: { backgroundColor: PRIMARY_TINT, borderColor: PRIMARY },
  transitionText: { color: '#1f2937', fontSize: 13 },
  transitionTextActive: { color: PRIMARY, fontWeight: '600' },

  updateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photoThumb: { width: 72, height: 72, position: 'relative' },
  photoImg: { width: 72, height: 72, borderRadius: 6 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 72, height: 72, borderRadius: 6, borderWidth: 2, borderStyle: 'dashed',
    borderColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY_TINT,
  },

  doneNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#f0fdf4',
    borderRadius: 10, marginBottom: 12,
  },
  doneNoticeText: { color: '#15803d', textAlign: 'center' },
});
