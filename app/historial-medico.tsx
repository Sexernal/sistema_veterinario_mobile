// app/historial-medico.tsx
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import api, { getCurrentPropietario, getMascotasByPropietario } from '../services/api';

type Mascota = {
  id: number;
  nombre?: string;
  [k: string]: any;
};

type RecordItem = {
  id: number;
  mascota_id: number;
  mascota_nombre?: string;
  tipo?: string;
  fecha?: string;
  fecha_display?: string;
  peso?: number | null;
  nota?: string | null;
  filepath?: string | null;
  filename?: string | null;
  creado_por_nombre?: string | null;
  [k: string]: any;
};

export default function HistorialMedicoScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [recordsByPet, setRecordsByPet] = useState<Record<string, RecordItem[]>>({});
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      await loadAll();
    })();
  }, []);

  const loadAll = async () => {
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

      // fetch records for each pet in paralelo
      const petCalls = (pets || []).map(async (pet: Mascota) => {
        try {
          const res = await api.get(`/medical-records?pet_id=${encodeURIComponent(pet.id)}`);
          return { petId: pet.id, data: res.data?.data || [] };
        } catch (err) {
          console.warn('Error fetching records for pet', pet.id, err);
          return { petId: pet.id, data: [] };
        }
      });

      const results = await Promise.all(petCalls);
      const map: Record<string, RecordItem[]> = {};
      for (const r of results) {
        map[String(r.petId)] = r.data;
      }
      setRecordsByPet(map);
    } catch (err) {
      console.error('Error cargando historial médico', err);
      Alert.alert('Error', 'No se pudo cargar el historial médico. Reintenta.');
      setMascotas([]);
      setRecordsByPet({});
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  };

  const makeFileUrl = (pathOrUrl?: string | null) => {
    if (!pathOrUrl) return null;
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const API_BASE = (process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:3001');
    return pathOrUrl.startsWith('/') ? `${API_BASE}${pathOrUrl}` : `${API_BASE}/${pathOrUrl}`;
  };

  const openFile = async (r: RecordItem) => {
    if (!r.filepath) {
      Alert.alert('Sin archivo', 'Esta ficha no tiene archivo adjunto.');
      return;
    }
    const url = makeFileUrl(r.filepath);
    try {
      if (url) await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Error', 'No se pudo abrir el archivo.');
    }
  };

  const openDetail = (r: RecordItem) => {
    setSelectedRecord(r);
    setModalVisible(true);
  };

  const closeDetail = () => {
    setModalVisible(false);
    setSelectedRecord(null);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={{ marginTop: 10 }}>Cargando historial médico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial médico</Text>
        <Text style={styles.subtitle}>Fichas médicas de tus mascotas</Text>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ marginTop: 12, marginBottom: 20 }}>
          {mascotas.length === 0 && <Text style={{ color: '#6b7280' }}>No tienes mascotas registradas.</Text>}

          {mascotas.map(p => {
            const records: RecordItem[] = recordsByPet[String(p.id)] || [];
            return (
              <View key={p.id} style={{ marginBottom: 16 }}>
                <Text style={{ fontWeight: '800', marginBottom: 8 }}>{p.nombre || `Mascota ${p.id}`}</Text>

                {records.length === 0 ? (
                  <View style={styles.emptyCard}><Text style={{ color: '#6b7280' }}>Sin fichas médicas</Text></View>
                ) : (
                  records.map(r => (
                    <View key={r.id} style={styles.recordCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 700 }}>{r.tipo || 'Registro'}</Text>
                        <Text style={{ color: '#6b7280', marginTop: 4 }}>{r.fecha_display || (r.fecha ? new Date(r.fecha).toLocaleString() : '')}</Text>
                        {r.nota ? <Text numberOfLines={2} style={{ marginTop: 6, color: '#374151' }}>{r.nota}</Text> : null}
                        <Text style={{ marginTop: 6, color: '#6b7280' }}>{r.peso != null ? `${Number(r.peso).toFixed(2)} kg` : ''} {r.creado_por_nombre ? `• ${r.creado_por_nombre}` : ''}</Text>
                      </View>

                      <View style={{ justifyContent: 'center', marginLeft: 8 }}>
                        <TouchableOpacity style={styles.smallBtn} onPress={() => openDetail(r)}>
                          <Text style={{ color: '#fff' }}>Ver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallBtn, { marginTop: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' }]} onPress={() => openFile(r)}>
                          <Text style={{ color: '#374151' }}>Abrir</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={closeDetail}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700' }}>{selectedRecord?.tipo || 'Ficha'}</Text>
              <TouchableOpacity onPress={closeDetail}><Text style={{ fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 700 }}>Fecha</Text>
                <Text style={{ color: '#6b7280' }}>{selectedRecord?.fecha_display || (selectedRecord?.fecha ? new Date(selectedRecord.fecha).toLocaleString() : '-')}</Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 700 }}>Peso</Text>
                <Text style={{ color: '#6b7280' }}>{selectedRecord?.peso != null ? `${Number(selectedRecord.peso).toFixed(2)} kg` : '-'}</Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 700 }}>Atendido por</Text>
                <Text style={{ color: '#6b7280' }}>{selectedRecord?.creado_por_nombre || '-'}</Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 700 }}>Nota / Observaciones</Text>
                <Text style={{ color: '#374151', marginTop: 6 }}>{selectedRecord?.nota || '-'}</Text>
              </View>

              {selectedRecord?.filepath ? (
                <View style={{ marginTop: 12, display: 'flex' }}>
                  <TouchableOpacity style={[styles.smallBtn, { marginBottom: 8 }]} onPress={() => selectedRecord && openFile(selectedRecord)}>
                    <Text style={{ color: '#fff' }}>Abrir archivo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' }]} onPress={() => selectedRecord && openFile(selectedRecord)}>
                    <Text style={{ color: '#374151' }}>Descargar</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
  recordCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallBtn: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  backButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', padding: 12, borderRadius: 10, alignItems: 'center' },
  backButtonText: { color: '#374151', fontWeight: '700' },
  emptyCard: { backgroundColor: '#fff', padding: 12, borderRadius: 8, alignItems: 'center' }
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxHeight: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 14 }
});