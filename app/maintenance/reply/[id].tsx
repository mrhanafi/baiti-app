import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Button, Card, HelperText, Icon, Text } from 'react-native-paper';

import { PhotoSourceSheet } from '@/components/photo-source-sheet';
import { PurpleHeader } from '@/components/purple-header';
import { TabletContainer } from '@/components/tablet-container';
import { ApiError } from '@/lib/api/client';
import { getToken } from '@/lib/auth/storage';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8123';

export default function ReplyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleAddPhoto() {
    setSheetOpen(true);
  }

  async function takePhoto() {
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

  async function handleSend() {
    if (!text.trim() || !id) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('text', text.trim());
      images.forEach((img, i) => {
        const name = img.fileName ?? `photo-${i}.jpg`;
        const type = img.mimeType ?? 'image/jpeg';
        // @ts-expect-error — RN FormData accepts {uri, name, type}
        formData.append('photos[]', { uri: img.uri, name, type });
      });

      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/v1/me/maintenance-reports/${id}/reply`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, json, json?.message);

      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const first = Object.values(err.body?.errors ?? {})[0] as string[] | undefined;
        setError(first?.[0] ?? 'Please fix the highlighted fields.');
      } else {
        setError('Could not send reply. Check your connection.');
      }
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <PurpleHeader title="Reply" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled">
         <TabletContainer>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.label}>Your reply</Text>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                placeholder="Add a comment, update, or follow-up..."
                placeholderTextColor="#9ca3af"
                maxLength={5000}
                style={styles.input}
              />

              <Text variant="titleSmall" style={[styles.label, { marginTop: 16 }]}>
                Photos (optional)
              </Text>
              <View style={styles.photoRow}>
                {images.map((img) => (
                  <View key={img.uri} style={styles.photoThumb}>
                    <Image source={{ uri: img.uri }} style={styles.photoImg} />
                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => setImages(images.filter((a) => a.uri !== img.uri))}>
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
              <Text variant="bodySmall" style={styles.hint}>Up to 5 photos.</Text>

              {error ? <HelperText type="error" visible style={{ marginTop: 8 }}>{error}</HelperText> : null}
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={handleSend}
            loading={loading}
            disabled={loading || !text.trim()}
            style={styles.submit}
            contentStyle={styles.submitContent}>
            Send reply
          </Button>
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
  inner: { padding: 16, paddingBottom: 120 },
  card: { marginBottom: 8, backgroundColor: '#fff' },
  label: { fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    minHeight: 120, textAlignVertical: 'top',
    fontSize: 15, lineHeight: 22, color: '#1f2937',
  },
  hint: { opacity: 0.55, marginTop: 4 },

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

  submit: { marginTop: 16 },
  submitContent: { paddingVertical: 8 },
});
