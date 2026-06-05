import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export default function BillsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Bills</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Billing module coming in a later chunk.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  subtitle: { marginTop: 8, opacity: 0.6, textAlign: 'center' },
});
