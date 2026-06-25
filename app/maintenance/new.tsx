import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { Button, Card, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { PhotoSourceSheet } from '@/components/photo-source-sheet';
import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { ApiError, apiFetch } from '@/lib/api/client';
import { getToken } from '@/lib/auth/storage';
import { useAuth } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';
// Same key as Home tab + Utilities + visitor/new — the resident's chosen "active home".
const SELECTED_UNIT_KEY = 'baiti.home.selected_unit_id';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8123';

const CATEGORIES = [
  { value: 'lift', label: 'Lift' },
  { value: 'water', label: 'Water' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'cleanliness', label: 'Cleanliness' },
  { value: 'security', label: 'Security' },
  { value: 'common_area', label: 'Common area' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' },
];

export default function NewReportScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const homes = user?.units ?? [];
  // Bound home for this report — read-only. Sourced from the Home tab's
  // active-home AsyncStorage key. To file for a different home, switch
  // on Home and come back.
  const [unitId, setUnitId] = useState<string>(homes[0]?.id ?? '');

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_UNIT_KEY).then((saved) => {
      if (saved && homes.some((u) => u.id === saved)) {
        setUnitId(saved);
      } else if (homes[0]?.id) {
        setUnitId(homes[0].id);
      }
    });
  }, [homes]);

  const boundHome = useMemo(
    () => homes.find((h) => h.id === unitId) ?? homes[0] ?? null,
    [homes, unitId],
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('other');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const submitDisabled = loading || !title.trim() || !body.trim() || !location.trim();

  function handleAddPhoto() {
    setSheetOpen(true);
  }

  async function takePhotoWithCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera disabled', 'Allow camera access in Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setImages([...images, ...result.assets].slice(0, 5));
    }
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
    });
    if (!result.canceled && result.assets) {
      setImages([...images, ...result.assets].slice(0, 5));
    }
  }

  function handleRemoveImage(uri: string) {
    setImages(images.filter((a) => a.uri !== uri));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    // We need multipart/form-data for photo uploads, so use fetch directly
    // rather than apiFetch (which sets JSON Content-Type).
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('body', body.trim());
      formData.append('location', location.trim());
      formData.append('category', category);
      if (unitId) formData.append('unit_id', unitId);
      images.forEach((img, i) => {
        const name = img.fileName ?? `photo-${i}.jpg`;
        const type = img.mimeType ?? 'image/jpeg';
        // @ts-expect-error — RN FormData accepts {uri, name, type}
        formData.append('photos[]', { uri: img.uri, name, type });
      });

      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/v1/me/maintenance-reports`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(res.status, json, json?.message);
      }
      router.replace({
        pathname: '/maintenance/[id]',
        params: { id: json.report.id },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const first = Object.values(err.body?.errors ?? {})[0] as string[] | undefined;
        setError(first?.[0] ?? 'Please fix the highlighted fields.');
      } else if (err instanceof ApiError) {
        setError(`Failed (${err.status}).`);
      } else {
        setError('Could not reach the server.');
      }
    }
    setLoading(false);
  }

  if (homes.length === 0) {
    return (
      <View style={styles.container}>
        <PurpleHeader title="New report" />
        <View style={styles.empty}>
          <Icon source="home-off-outline" size={48} color="#9ca3af" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Verify your home first to file maintenance reports.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title="New Maintenance Report" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
         <TabletContainer>

          {boundHome ? (
            <Card style={styles.contextCard}>
              <Card.Content style={styles.contextContent}>
                <View style={styles.contextIcon}>
                  <Icon source="home-city" size={24} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                    {boundHome.property_name ?? 'Your home'}
                  </Text>
                  <Text variant="bodySmall" style={{ opacity: 0.65, marginTop: 2 }}>
                    Unit {boundHome.unit_number}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ) : null}

          <Card style={styles.card}>
            <Card.Content>
              <TextInput
                label="Title *"
                value={title}
                onChangeText={setTitle}
                mode="outlined"
                style={styles.input}
                placeholder="e.g. Lift A stuck on 5th floor"
                maxLength={255}
              />
              <TextInput
                label="What's the issue? *"
                value={body}
                onChangeText={setBody}
                mode="outlined"
                style={styles.input}
                multiline
                numberOfLines={5}
                placeholder="Describe what's happening..."
                maxLength={5000}
              />
              <TextInput
                label="Where? *"
                value={location}
                onChangeText={setLocation}
                mode="outlined"
                style={styles.input}
                placeholder="e.g. Lift A, ground floor / My unit bathroom"
                maxLength={255}
              />

              <Text variant="titleSmall" style={styles.section}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={[styles.categoryChip, category === c.value && styles.categoryChipActive]}>
                    <Text style={[styles.categoryText, category === c.value && styles.categoryTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text variant="titleSmall" style={styles.section}>Photos (optional)</Text>
              <View style={styles.photoRow}>
                {images.map((img) => (
                  <View key={img.uri} style={styles.photoThumb}>
                    <Image source={{ uri: img.uri }} style={styles.photoImg} />
                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => handleRemoveImage(img.uri)}>
                      <Icon source="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {images.length < 5 ? (
                  <Pressable style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                    <Icon source="image-plus" size={24} color={PRIMARY} />
                  </Pressable>
                ) : null}
              </View>
              <Text variant="bodySmall" style={styles.hint}>
                Up to 5 photos.
              </Text>

              {error ? <HelperText type="error" visible style={{ marginTop: 8 }}>{error}</HelperText> : null}
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={submitDisabled}
            style={styles.submit}
            contentStyle={styles.submitContent}>
            File report
          </Button>

          <Text variant="bodySmall" style={styles.disclaimer}>
            Your JMB admin will get an email and respond in the thread. You'll be notified of replies.
          </Text>
         </TabletContainer>
        </ScrollView>
      </KeyboardAvoidingView>

      <PhotoSourceSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onTakePhoto={takePhotoWithCamera}
        onPickFromLibrary={pickFromLibrary}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 16, paddingBottom: 120 },
  card: { marginBottom: 8, backgroundColor: '#fff' },

  contextCard: { marginBottom: 8 },
  contextContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contextIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },

  section: { marginTop: 16, marginBottom: 8, fontWeight: '600' },
  input: { marginBottom: 8 },
  hint: { opacity: 0.55, marginTop: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { marginTop: 12, opacity: 0.7, textAlign: 'center' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: 'transparent',
  },
  categoryChipActive: { backgroundColor: PRIMARY_TINT, borderColor: PRIMARY },
  categoryText: { color: '#1f2937' },
  categoryTextActive: { color: PRIMARY, fontWeight: '600' },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: 80, height: 80, position: 'relative' },
  photoImg: { width: 80, height: 80, borderRadius: 6 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: 6, borderWidth: 2, borderStyle: 'dashed',
    borderColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY_TINT,
  },

  submit: { marginTop: 24 },
  submitContent: { paddingVertical: 8 },
  disclaimer: { marginTop: 16, opacity: 0.55, textAlign: 'center', lineHeight: 18 },
});
