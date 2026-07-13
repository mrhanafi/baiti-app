import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Props = {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onPickFromLibrary: () => void;
};

export function PhotoSourceSheet({ visible, onClose, onTakePhoto, onPickFromLibrary }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Keep the Modal mounted through the slide-out animation. We unmount only
  // after the exit animation finishes.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, translateY, opacity]);

  function handle(opt: 'camera' | 'library') {
    onClose();
    // Wait for the slide-out animation, then trigger the picker — otherwise
    // iOS shows the OS permission prompt over a half-dismissed modal.
    setTimeout(() => {
      if (opt === 'camera') onTakePhoto();
      else onPickFromLibrary();
    }, 220);
  }

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16, transform: [{ translateY }] },
          ]}>
          <View style={styles.handle} />

          <Text variant="titleMedium" style={styles.title}>{t('common.addPhoto')}</Text>

          <Pressable
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={() => handle('camera')}>
            <View style={styles.tileIcon}>
              <Icon source="camera" size={26} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyLarge" style={styles.tileLabel}>{t('common.takePhoto')}</Text>
              <Text variant="bodySmall" style={styles.tileSub}>{t('common.useYourCamera')}</Text>
            </View>
            <Icon source="chevron-right" size={20} color="#9ca3af" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={() => handle('library')}>
            <View style={styles.tileIcon}>
              <Icon source="image-multiple" size={26} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyLarge" style={styles.tileLabel}>{t('common.chooseFromLibrary')}</Text>
              <Text variant="bodySmall" style={styles.tileSub}>{t('common.pickExistingPhotos')}</Text>
            </View>
            <Icon source="chevron-right" size={20} color="#9ca3af" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelPressed]}
            onPress={onClose}>
            <Text variant="bodyLarge" style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 12,
  },
  title: {
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  tilePressed: { backgroundColor: PRIMARY_TINT },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontWeight: '600' },
  tileSub: { opacity: 0.55, marginTop: 2 },

  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelPressed: { backgroundColor: '#e5e7eb' },
  cancelText: { fontWeight: '600', color: '#374151' },
});
