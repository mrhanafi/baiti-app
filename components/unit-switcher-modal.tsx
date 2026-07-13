import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Modal, Portal, Text } from 'react-native-paper';

import type { Unit } from '@/lib/auth/session';

const PRIMARY = '#7367F0';
const PRIMARY_TINT = '#EEEDFD';

type Props = {
  visible: boolean;
  units: Unit[];
  selectedUnitId: string | null;
  onDismiss: () => void;
  onSelect: (unitId: string) => void;
};

/**
 * Bottom-sheet-style modal that lists the resident's units across all JMBs
 * they're a member of. Tap one → it becomes the active context for the home
 * tab. Selection persists across app launches (handled by the parent).
 */
export function UnitSwitcherModal({ visible, units, selectedUnitId, onDismiss, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t('common.switchHome')}</Text>
        <Text style={styles.subtitle}>
          {units.length === 1 ? t('common.oneHome') : t('common.manyHomes', { count: units.length })}
        </Text>

        <FlatList
          data={units}
          keyExtractor={(u) => u.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedUnitId;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.id);
                  onDismiss();
                }}
                style={[styles.row, isSelected && styles.rowSelected]}>
                <View style={styles.iconWrap}>
                  <Icon source="home-city" size={22} color={PRIMARY} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.unitName} numberOfLines={1}>
                    {t('common.unit', { number: item.unit_number })}
                    {item.block_name ? ` · ${item.block_name}` : ''}
                  </Text>
                  <Text style={styles.propertyName} numberOfLines={1}>
                    {item.property_name ?? '—'}
                  </Text>
                  {item.organization_name ? (
                    <Text style={styles.orgName} numberOfLines={1}>
                      {item.organization_name}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? (
                  <Icon source="check-circle" size={22} color={PRIMARY} />
                ) : (
                  <Icon source="chevron-right" size={22} color="#9ca3af" />
                )}
              </Pressable>
            );
          }}
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2, marginBottom: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
    gap: 12,
  },
  rowSelected: { backgroundColor: PRIMARY_TINT },
  iconWrap: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: PRIMARY_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  unitName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  propertyName: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  orgName: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
});
