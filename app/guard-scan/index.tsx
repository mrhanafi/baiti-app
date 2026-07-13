import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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
    const tagValue = tagQuery.trim();
    if (!tagValue) return;
    setTagBusy(true);
    try {
      const data = await apiFetch(`/api/v1/guard/passes/by-tag?tag=${encodeURIComponent(tagValue)}`);
      const passes = data.passes ?? [];
      if (passes.length === 0) {
        Alert.alert(t('guard.scan.noMatch'), t('guard.scan.noMatchBody', { tag: tagValue }));
      } else if (passes.length === 1) {
        setTagQuery('');
        router.push({ pathname: '/guard-pass/[id]', params: { id: passes[0].id } });
      } else {
        // Rare: tag reused. Show a picker via simple Alert.
        Alert.alert(
          t('guard.scan.multipleMatches'),
          t('guard.scan.multipleMatchesBody', { count: passes.length, tag: tagValue }),
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
      Alert.alert(t('guard.scan.lookupFailed'), t('guard.scan.lookupFailedBody'));
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
      const msg = err instanceof ApiError ? (err.body?.errors?.qr_token?.[0] ?? err.message) : t('guard.scan.couldNotLookUp');
      Alert.alert(t('guard.scan.scanFailed'), msg, [{ text: t('guard.ok'), onPress: () => setScanning(true) }]);
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
        <Text style={styles.title}>{t('guard.scan.title')}</Text>
      </View>

      <View style={styles.walkInRow}>
        <Button
          mode="contained"
          icon="account-plus"
          onPress={() => router.push('/walk-in')}
          style={styles.walkInBtn}
          contentStyle={{ paddingVertical: 2 }}>
          {t('guard.scan.walkInVisitor')}
        </Button>
      </View>

      <View style={styles.cameraWrap}>
        {!permission ? (
          <View style={styles.fallback}><ActivityIndicator /></View>
        ) : !permission.granted ? (
          <View style={styles.fallback}>
            <Icon source="camera-off" size={48} color="#9ca3af" />
            <Text variant="bodyMedium" style={{ marginTop: 12, textAlign: 'center' }}>
              {t('guard.scan.cameraPermission')}
            </Text>
            <Button onPress={requestPermission} mode="contained" style={{ marginTop: 16 }}>
              {t('guard.scan.grantPermission')}
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
        <Text variant="labelMedium" style={styles.searchLabel}>{t('guard.scan.findByTag')}</Text>
        <View style={styles.tagRow}>
          <TextInput
            value={tagQuery}
            onChangeText={setTagQuery}
            mode="outlined"
            placeholder={t('guard.scan.tagPlaceholder')}
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
            {t('guard.scan.find')}
          </Button>
        </View>

        <Text variant="labelMedium" style={[styles.searchLabel, { marginTop: 16 }]}>{t('guard.scan.lookupByName')}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          mode="outlined"
          placeholder={t('guard.scan.searchPlaceholder')}
          left={<TextInput.Icon icon="magnify" />}
          autoCapitalize="none"
          style={styles.searchInput}
        />
        {searching ? <HelperText type="info" visible>{t('guard.scan.searching')}</HelperText> : null}
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
                      {t('common.unit', { number: r.unit.unit_number })}{r.vehicle_plate ? ` · ${r.vehicle_plate}` : ''}
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
