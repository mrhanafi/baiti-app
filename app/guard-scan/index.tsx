import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, HelperText, Icon, IconButton, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, apiFetch } from '@/lib/api/client';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type SearchResult = {
  id: string;
  visitor_name: string;
  vehicle_plate: string | null;
  unit: { unit_number: string | null; property_name: string | null };
};

export default function GuardScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  // Debounce: after a scan, ignore camera frames for a moment so we don't
  // multi-fire while navigating.
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [tagQuery, setTagQuery] = useState('');
  const [tagBusy, setTagBusy] = useState(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch(`/api/v1/guard/passes/search?q=${encodeURIComponent(q)}`);
        setResults(data.passes ?? []);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  // Find by physical tag (e.g. visitor returns card "042" at exit time).
  async function handleTagLookup() {
    const t = tagQuery.trim();
    if (!t) return;
    setTagBusy(true);
    try {
      const data = await apiFetch(`/api/v1/guard/passes/by-tag?tag=${encodeURIComponent(t)}`);
      const passes = data.passes ?? [];
      if (passes.length === 0) {
        Alert.alert('No match', `No open visit found with tag ${t}.`);
      } else if (passes.length === 1) {
        setTagQuery('');
        router.push({ pathname: '/guard-pass/[id]', params: { id: passes[0].id } });
      } else {
        // Rare: tag reused. Show a picker via simple Alert.
        Alert.alert(
          'Multiple matches',
          `Found ${passes.length} visits with tag ${t}. Pick one.`,
          passes.map((p: SearchResult) => ({
            text: p.visitor_name,
            onPress: () => {
              setTagQuery('');
              router.push({ pathname: '/guard-pass/[id]', params: { id: p.id } });
            },
          })),
        );
      }
    } catch {
      Alert.alert('Lookup failed', 'Could not search by tag.');
    }
    setTagBusy(false);
  }

  async function handleScan(token: string) {
    const now = Date.now();
    if (lastScanRef.current?.token === token && now - lastScanRef.current.at < 3000) {
      return; // debounce duplicate frames
    }
    lastScanRef.current = { token, at: now };
    setScanning(false);

    try {
      const data = await apiFetch('/api/v1/guard/scan/lookup', {
        method: 'POST',
        body: JSON.stringify({ qr_token: token }),
      });
      router.push({ pathname: '/guard-pass/[id]', params: { id: data.pass.id } });
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body?.errors?.qr_token?.[0] ?? err.message) : 'Could not look up.';
      Alert.alert('Scan failed', msg, [{ text: 'OK', onPress: () => setScanning(true) }]);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton
          icon="arrow-left"
          iconColor="#fff"
          size={24}
          onPress={() => router.back()}
          style={styles.backBtn}
        />
        <Text style={styles.title}>Scan visitor</Text>
      </View>

      <View style={styles.walkInRow}>
        <Button
          mode="contained"
          icon="account-plus"
          onPress={() => router.push('/walk-in')}
          style={styles.walkInBtn}
          contentStyle={{ paddingVertical: 2 }}>
          Walk-in visitor
        </Button>
      </View>

      <View style={styles.cameraWrap}>
        {!permission ? (
          <View style={styles.fallback}><ActivityIndicator /></View>
        ) : !permission.granted ? (
          <View style={styles.fallback}>
            <Icon source="camera-off" size={48} color="#9ca3af" />
            <Text variant="bodyMedium" style={{ marginTop: 12, textAlign: 'center' }}>
              Camera permission is needed to scan QR codes.
            </Text>
            <Button onPress={requestPermission} mode="contained" style={{ marginTop: 16 }}>
              Grant permission
            </Button>
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanning ? (event) => handleScan(event.data) : undefined}>
            <View style={styles.viewfinder} />
          </CameraView>
        )}
      </View>

      <View style={styles.searchPanel}>
        <Text variant="labelMedium" style={styles.searchLabel}>Visitor exiting? Find by tag</Text>
        <View style={styles.tagRow}>
          <TextInput
            value={tagQuery}
            onChangeText={setTagQuery}
            mode="outlined"
            placeholder="e.g. 042"
            autoCapitalize="characters"
            style={{ flex: 1 }}
            onSubmitEditing={handleTagLookup}
            returnKeyType="search"
            maxLength={20}
          />
          <Button
            mode="contained"
            onPress={handleTagLookup}
            loading={tagBusy}
            disabled={tagBusy || !tagQuery.trim()}
            contentStyle={{ paddingVertical: 4 }}>
            Find
          </Button>
        </View>

        <Text variant="labelMedium" style={[styles.searchLabel, { marginTop: 16 }]}>Or look up by name / plate</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          mode="outlined"
          placeholder="Name, phone, or plate"
          left={<TextInput.Icon icon="magnify" />}
          autoCapitalize="none"
          style={styles.searchInput}
        />
        {searching ? <HelperText type="info" visible>Searching…</HelperText> : null}
        {results.length > 0 ? (
          <View style={styles.results}>
            {results.map((r) => (
              <Card key={r.id} style={styles.resultCard}
                onPress={() => router.push({ pathname: '/guard-pass/[id]', params: { id: r.id } })}>
                <Card.Content style={styles.resultContent}>
                  <View style={styles.resultIcon}>
                    <Icon source="account" size={20} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ fontWeight: '600' }}>{r.visitor_name}</Text>
                    <Text variant="bodySmall" style={{ opacity: 0.65 }}>
                      Unit {r.unit.unit_number}{r.vehicle_plate ? ` · ${r.vehicle_plate}` : ''}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  backBtn: { margin: 0 },
  title: { color: '#fff', fontSize: 22, fontWeight: '600' },

  walkInRow: { backgroundColor: PRIMARY, paddingHorizontal: 16, paddingBottom: 12 },
  walkInBtn: { backgroundColor: 'rgba(255,255,255,0.18)' },
  cameraWrap: { height: 280, backgroundColor: '#000' },
  camera: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewfinder: {
    width: 220, height: 220, borderRadius: 16, borderWidth: 3, borderColor: 'rgba(255,255,255,0.75)',
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#111' },

  searchPanel: { flex: 1, backgroundColor: '#fff', padding: 16 },
  searchLabel: { opacity: 0.65, marginBottom: 4 },
  searchInput: { marginBottom: 4 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  results: { marginTop: 8 },
  resultCard: { marginBottom: 8 },
  resultContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
});
