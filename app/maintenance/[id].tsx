import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Icon,
  IconButton,
  Text,
} from 'react-native-paper';
import ImageView from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { ApiError, apiFetch } from '@/lib/api/client';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Photo = { id: string; url: string };
type Update = {
  id: string;
  text: string | null;
  status_changed_to: 'open' | 'in_progress' | 'resolved' | 'closed' | null;
  created_at: string;
  author: { id: string | null; name: string | null };
  photos: Photo[];
};
type Report = {
  id: string;
  title: string;
  body: string;
  location: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  reporter: { id: string | null; name: string | null };
  unit: { unit_number: string | null };
  photos: Photo[];
  updates: Update[];
};

const STATUS_META: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: '#fef3c7', fg: '#92400e', label: 'Open' },
  in_progress: { bg: '#dbeafe', fg: '#1d4ed8', label: 'In progress' },
  resolved: { bg: '#dcfce7', fg: '#15803d', label: 'Resolved' },
  closed: { bg: '#f3f4f6', fg: '#6b7280', label: 'Closed' },
};

export default function ReportDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerPhotos, setViewerPhotos] = useState<Photo[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeText, setDisputeText] = useState('');
  const [resolveBusy, setResolveBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v1/me/maintenance-reports/${id}`);
      setReport(data.report);
    } catch {
      setReport(null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openViewer(photos: Photo[], index: number) {
    setViewerPhotos(photos);
    setViewerIndex(index);
  }

  async function handleConfirmResolved() {
    if (!report) return;
    setResolveBusy(true);
    try {
      const data = await apiFetch(`/api/v1/me/maintenance-reports/${report.id}/confirm`, {
        method: 'POST',
      });
      setReport(data.report);
    } catch {
      Alert.alert('Could not confirm', 'Check your connection and try again.');
    }
    setResolveBusy(false);
  }

  async function handleDisputeResolved() {
    if (!report || !disputeText.trim()) return;
    setResolveBusy(true);
    try {
      const data = await apiFetch(`/api/v1/me/maintenance-reports/${report.id}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ text: disputeText.trim() }),
      });
      setReport(data.report);
      setDisputeText('');
      setDisputeOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const first = Object.values(err.body?.errors ?? {})[0] as string[] | undefined;
        Alert.alert('Could not submit', first?.[0] ?? 'Please add a short reason.');
      } else {
        Alert.alert('Could not submit', 'Check your connection and try again.');
      }
    }
    setResolveBusy(false);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Report" />
        <View style={styles.center}><ActivityIndicator /></View>
      </View>
    );
  }
  if (!report) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="Report" />
        <View style={styles.center}>
          <Icon source="alert-circle-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, opacity: 0.7 }}>Report not found.</Text>
          <Button onPress={() => router.back()} style={{ marginTop: 16 }}>Go back</Button>
        </View>
      </View>
    );
  }

  const canFreeReply = report.status === 'open' || report.status === 'in_progress';
  const isResolved = report.status === 'resolved';

  return (
    <View style={styles.container}>
      <PurpleHeader title="Report" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled">
       <TabletContainer>

          {/* Header card */}
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.title}>{report.title}</Text>
              <Text variant="bodySmall" style={styles.meta}>
                {prettyCategory(report.category)} · {report.location}
              </Text>
              <Text variant="bodySmall" style={styles.meta}>
                Filed {new Date(report.created_at).toLocaleString()}
              </Text>

              <StatusStepper status={report.status} />
            </Card.Content>
          </Card>

          {/* Initial report body */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.postHeader}>
                <View style={[styles.avatar, styles.avatarOwner]}>
                  <Text style={styles.avatarText}>{initial(report.reporter.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={styles.postAuthor}>
                    {report.reporter.name ?? 'You'}
                  </Text>
                  <Text variant="bodySmall" style={styles.postTime}>
                    {new Date(report.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
              <Text variant="bodyMedium" style={styles.body}>{report.body}</Text>
              {report.photos.length > 0 ? (
                <PhotoStrip photos={report.photos} onTap={(i) => openViewer(report.photos, i)} />
              ) : null}
            </Card.Content>
          </Card>

          {/* Timeline */}
          {report.updates.map((u) => {
            const isAdminPost = u.author.id !== report.reporter.id;
            return (
              <Card key={u.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.postHeader}>
                    <View style={[styles.avatar, isAdminPost ? styles.avatarAdmin : styles.avatarOwner]}>
                      <Text style={styles.avatarText}>{initial(u.author.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.postAuthorRow}>
                        <Text variant="bodyMedium" style={styles.postAuthor}>
                          {u.author.name ?? '—'}
                        </Text>
                        {isAdminPost ? (
                          <View style={styles.jmbBadge}>
                            <Text style={styles.jmbBadgeText}>JMB</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text variant="bodySmall" style={styles.postTime}>
                        {new Date(u.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  {u.status_changed_to ? (
                    <View style={styles.statusChangeRow}>
                      <Text variant="bodySmall" style={{ opacity: 0.65 }}>Status →</Text>
                      <View style={[styles.statusPill, {
                        backgroundColor: STATUS_META[u.status_changed_to]?.bg ?? '#f3f4f6',
                      }]}>
                        <Text style={[styles.statusText, {
                          color: STATUS_META[u.status_changed_to]?.fg ?? '#6b7280',
                        }]}>
                          {STATUS_META[u.status_changed_to]?.label ?? u.status_changed_to}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {u.text ? <Text variant="bodyMedium" style={styles.body}>{u.text}</Text> : null}
                  {u.photos.length > 0 ? (
                    <PhotoStrip photos={u.photos} onTap={(i) => openViewer(u.photos, i)} />
                  ) : null}
                </Card.Content>
              </Card>
            );
          })}

          {/* Bottom action area — sits at the end of the timeline */}
          {canFreeReply ? (
            <Button
              mode="contained"
              icon="reply"
              onPress={() => router.push({ pathname: '/maintenance/reply/[id]', params: { id: report.id } })}
              style={styles.replyBtn}
              contentStyle={styles.replyBtnContent}>
              Reply
            </Button>
          ) : isResolved ? (
            <View style={styles.resolveBar}>
              <Text variant="bodySmall" style={styles.resolveBarPrompt}>
                Is this issue fixed?
              </Text>
              <View style={styles.resolveBarRow}>
                <Pressable
                  onPress={() => setDisputeOpen(true)}
                  disabled={resolveBusy}
                  style={[styles.resolveBtn, styles.resolveBtnDispute]}>
                  <Icon source="alert-circle-outline" size={16} color="#b91c1c" />
                  <Text style={styles.resolveBtnDisputeText}>Still not fixed</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmResolved}
                  disabled={resolveBusy}
                  style={[styles.resolveBtn, styles.resolveBtnConfirm]}>
                  <Icon source="check-circle-outline" size={16} color="#fff" />
                  <Text style={styles.resolveBtnConfirmText}>Confirm fixed</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.closedNotice}>
              <Icon source="lock-outline" size={16} color="#6b7280" />
              <Text variant="bodySmall" style={styles.closedNoticeText}>
                This report is closed. Contact your JMB to reopen.
              </Text>
            </View>
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

      <DisputeModal
        visible={disputeOpen}
        text={disputeText}
        onChangeText={setDisputeText}
        onCancel={() => { setDisputeOpen(false); setDisputeText(''); }}
        onSubmit={handleDisputeResolved}
        busy={resolveBusy}
      />
    </View>
  );
}

const STATUS_FLOW: Report['status'][] = ['open', 'in_progress', 'resolved', 'closed'];

function StatusStepper({ status }: { status: Report['status'] }) {
  const currentIdx = STATUS_FLOW.indexOf(status);
  return (
    <View style={styles.stepperRow}>
      {STATUS_FLOW.map((s, i) => {
        const isCurrent = i === currentIdx;
        const isDone = i <= currentIdx;
        return (
          <View key={s} style={styles.stepCol}>
            <View style={styles.stepLineWrap}>
              <View style={[
                styles.stepLine,
                i === 0 ? styles.stepLineHidden : i <= currentIdx ? styles.stepLineDone : null,
              ]} />
              <View style={[
                styles.stepDot,
                isDone ? styles.stepDotDone : null,
                isCurrent ? styles.stepDotCurrent : null,
              ]}>
                {isDone && !isCurrent ? (
                  <Icon source="check" size={12} color="#fff" />
                ) : null}
              </View>
              <View style={[
                styles.stepLine,
                i === STATUS_FLOW.length - 1 ? styles.stepLineHidden : i < currentIdx ? styles.stepLineDone : null,
              ]} />
            </View>
            <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}>
              {STATUS_META[s].label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function DisputeModal({
  visible,
  text,
  onChangeText,
  onCancel,
  onSubmit,
  busy,
}: {
  visible: boolean;
  text: string;
  onChangeText: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  if (!visible) return null;
  return (
    <View style={styles.disputeBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={styles.disputeCard}>
        <Text variant="titleMedium" style={styles.disputeTitle}>Still not fixed?</Text>
        <Text variant="bodySmall" style={styles.disputeHint}>
          Tell the JMB what's still wrong. The report will be reopened.
        </Text>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          multiline
          placeholder="e.g. Water is still leaking, worse now"
          placeholderTextColor="#9ca3af"
          maxLength={5000}
          style={styles.disputeInput}
        />
        <View style={styles.disputeButtons}>
          <Pressable onPress={onCancel} style={[styles.disputeBtn, styles.disputeBtnCancel]}>
            <Text style={styles.disputeBtnCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onSubmit}
            disabled={busy || !text.trim()}
            style={[
              styles.disputeBtn,
              styles.disputeBtnSubmit,
              (busy || !text.trim()) && styles.disputeBtnSubmitDisabled,
            ]}>
            <Text style={styles.disputeBtnSubmitText}>{busy ? 'Submitting...' : 'Submit'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PhotoStrip({
  photos,
  onTap,
}: {
  photos: Photo[];
  onTap: (index: number) => void;
}) {
  return (
    <View style={styles.photoStripRow}>
      {photos.map((p, i) => (
        <Pressable key={p.id} onPress={() => onTap(i)} style={styles.photoStripItem}>
          <Image source={{ uri: p.url }} style={styles.photoStripImg} />
        </Pressable>
      ))}
    </View>
  );
}

function prettyCategory(c: string): string {
  return c.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

function initial(name: string | null): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  card: { marginBottom: 12 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontWeight: '700' },
  meta: { opacity: 0.65, marginTop: 4 },
  body: { lineHeight: 22, marginTop: 4 },

  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postAuthor: { fontWeight: '600' },
  postTime: { opacity: 0.55, marginTop: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarAdmin: { backgroundColor: PRIMARY },
  avatarOwner: { backgroundColor: '#9ca3af' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  jmbBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: PRIMARY_TINT,
  },
  jmbBadgeText: { color: PRIMARY, fontSize: 10, fontWeight: '700' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },

  stepperRow: { flexDirection: 'row', marginTop: 16, marginBottom: 4 },
  stepCol: { flex: 1, alignItems: 'center' },
  stepLineWrap: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 26 },
  stepLine: { flex: 1, height: 2, backgroundColor: '#e5e7eb' },
  stepLineDone: { backgroundColor: PRIMARY },
  stepLineHidden: { backgroundColor: 'transparent' },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: PRIMARY },
  stepDotCurrent: { backgroundColor: PRIMARY },
  stepLabel: { fontSize: 11, marginTop: 6, opacity: 0.55, textAlign: 'center' },
  stepLabelCurrent: { color: PRIMARY, fontWeight: '700', opacity: 1 },

  photoStripRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  photoStripItem: { width: 90, height: 90, borderRadius: 6, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  photoStripImg: { width: '100%', height: '100%' },

  replyBtn: { marginTop: 8 },
  replyBtnContent: { paddingVertical: 6 },

  closedNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    marginTop: 8,
  },
  closedNoticeText: { color: '#6b7280', textAlign: 'center' },

  resolveBar: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    marginTop: 8,
  },
  resolveBarPrompt: { textAlign: 'center', opacity: 0.65, marginBottom: 10 },
  resolveBarRow: { flexDirection: 'row', gap: 8 },
  resolveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10,
  },
  resolveBtnDispute: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  resolveBtnDisputeText: { color: '#b91c1c', fontWeight: '600', fontSize: 14 },
  resolveBtnConfirm: { backgroundColor: PRIMARY },
  resolveBtnConfirmText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  disputeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  disputeCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  disputeTitle: { fontWeight: '700', marginBottom: 4 },
  disputeHint: { opacity: 0.65, marginBottom: 12 },
  disputeInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    minHeight: 90, textAlignVertical: 'top',
    fontSize: 15, color: '#1f2937',
  },
  disputeButtons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  disputeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  disputeBtnCancel: { backgroundColor: '#f3f4f6' },
  disputeBtnCancelText: { color: '#374151', fontWeight: '600' },
  disputeBtnSubmit: { backgroundColor: '#dc2626' },
  disputeBtnSubmitDisabled: { backgroundColor: '#fca5a5' },
  disputeBtnSubmitText: { color: '#fff', fontWeight: '700' },

  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  viewerCount: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
