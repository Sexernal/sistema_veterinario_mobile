// app/mascotas.tsx
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {
    getCurrentPropietario,
    getMascotasByPropietario
} from '../services/api';

type Mascota = {
  id: number;
  nombre?: string;
  especie?: string;
  raza?: string;
  edad?: number | null;
  historial_medico?: string | null;
  owner_id?: number | null;
  propietario_id?: number | null;
  created_at?: string | null;
  [k: string]: any;
};

export default function MascotasScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [selected, setSelected] = useState<Mascota | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      await loadData();
    })();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await getCurrentPropietario();
      if (!p?.id) {
        Alert.alert('Error', 'No se encontró sesión. Vuelve a iniciar sesión.');
        router.replace('/');
        return;
      }
      setUser(p);
      const pets = await getMascotasByPropietario(p.id);
      setMascotas(pets || []);
    } catch (err) {
      console.error('Error cargando mascotas', err);
      Alert.alert('Error', 'No se pudieron cargar las mascotas. Reintenta.');
      setMascotas([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const openDetail = (m: Mascota) => {
    setSelected(m);
    setModalVisible(true);
  };

  const closeDetail = () => {
    setModalVisible(false);
    setSelected(null);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={{ marginTop: 10 }}>Cargando mascotas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis mascotas</Text>
        <Text style={styles.subtitle}>Ver detalles de tus mascotas</Text>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ marginTop: 12, marginBottom: 8 }}>
          {mascotas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: '#6b7280' }}>No tienes mascotas registradas.</Text>
            </View>
          ) : (
            mascotas.map(m => {
              const edadText = (m.edad !== undefined && m.edad !== null) ? `${m.edad} años` : '-';
              const especieRaza = ((m.especie || '-') + (m.raza ? ` • ${m.raza}` : ''));
              return (
                <View key={m.id} style={styles.petCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>{m.nombre || '—'}</Text>
                    <Text style={{ color: '#6b7280' }}>{especieRaza}</Text>
                    <Text style={{ color: '#6b7280' }}>{edadText}</Text>
                    {m.historial_medico ? (
                      <Text numberOfLines={2} style={{ marginTop: 6, color: '#374151' }}>
                        {m.historial_medico}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ justifyContent: 'center' }}>
                    <TouchableOpacity style={styles.smallBtn} onPress={() => openDetail(m)}>
                      <Text style={{ color: '#fff' }}>Ver</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>


      {/* Detail modal (sin foto, sin mostrar ID/propietario) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={closeDetail}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700' }}>{selected?.nombre || 'Mascota'}</Text>
              <TouchableOpacity onPress={closeDetail}><Text style={{ fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 700 }}>Especie / Raza</Text>
                <Text style={{ color: '#6b7280' }}>{(selected?.especie || '-') + (selected?.raza ? ` • ${selected?.raza}` : '')}</Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 700 }}>Edad</Text>
                <Text style={{ color: '#6b7280' }}>{selected?.edad != null ? `${selected?.edad} años` : '-'}</Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 700 }}>Historial médico</Text>
                <Text style={{ color: '#374151', marginTop: 6 }}>{selected?.historial_medico || '-'}</Text>
              </View>

              <View style={{ height: 12 }} />
            </ScrollView>

            <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.smallBtn, { flex: 1 }]} onPress={closeDetail}>
                <Text style={{ color: '#fff', textAlign: 'center' }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#059669', paddingVertical: 28, paddingHorizontal: 18, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#D1FAE5', marginTop: 4 },
  petCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallBtn: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  backButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', padding: 12, borderRadius: 10, alignItems: 'center' },
  backButtonText: { color: '#374151', fontWeight: '700' },
  emptyCard: { backgroundColor: '#fff', padding: 18, borderRadius: 10, alignItems: 'center' }
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxHeight: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 14 }
});