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
  View,
} from 'react-native';
import { C, S, SPECIES_ICONS } from '../constants/theme';
import api, { API_URL, getCurrentPropietario, getMascotasByPropietario } from '../services/api';

type Mascota   = { id: number; nombre?: string; especie?: string; [k: string]: any };
type RecordItem = {
  id: number;
  mascota_id: number;
  tipo?: string;
  tipo_personalizado?: string | null;
  fecha?: string;
  fecha_display?: string;
  peso?: number | null;
  temperatura?: number | null;
  nota?: string | null;
  filepath?: string | null;
  creado_por_nombre?: string | null;
  [k: string]: any;
};

const RECORD_ICONS: Record<string, string> = {
  vacuna: '💉', vacunacion: '💉',
  consulta: '🩺', 'consulta general': '🩺',
  cirugia: '🔬', cirugía: '🔬',
  control: '📋',
  desparasitacion: '🧴', desparasitación: '🧴',
  peluqueria: '✂️', peluquería: '✂️',
  urgencia: '🚨',
};

const getRecordIcon = (tipo?: string) =>
  RECORD_ICONS[(tipo || '').toLowerCase()] ?? '📄';

const getSpeciesIcon = (especie?: string) =>
  SPECIES_ICONS[(especie || '').toLowerCase()] ?? '🐾';

const formatDate = (r: RecordItem) => {
  if (r.fecha_display) return r.fecha_display;
  if (!r.fecha) return '—';
  return new Date(r.fecha).toLocaleDateString('es-CR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

// Base para archivos adjuntos con ruta relativa: mismo servidor que el API,
// derivado de API_URL para no duplicar la IP en dos lugares.
const API_BASE = API_URL.replace(/\/api\/v1\/?$/, '');

// Fichas de tipo "otro" guardan el nombre real en tipo_personalizado
const displayTipo = (r: RecordItem) =>
  (r.tipo || '').toLowerCase() === 'otro' && r.tipo_personalizado
    ? r.tipo_personalizado
    : (r.tipo || 'Registro');

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function RecordCard({ record, onPress }: { record: RecordItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.recordCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.recordIcon}>
        <Text style={{ fontSize: 22 }}>{getRecordIcon(record.tipo)}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={S.h3}>{displayTipo(record)}</Text>
        <Text style={S.small}>📅 {formatDate(record)}</Text>
        {record.peso != null && (
          <Text style={S.small}>⚖️ {Number(record.peso).toFixed(2)} kg</Text>
        )}
        {record.temperatura != null && (
          <Text style={S.small}>🌡️ {Number(record.temperatura).toFixed(1)} °C</Text>
        )}
        {record.nota ? (
          <Text numberOfLines={2} style={[S.small, { marginTop: 4, color: C.subtext }]}>
            {record.nota}
          </Text>
        ) : null}
        {record.creado_por_nombre ? (
          <Text style={[S.small, { marginTop: 2 }]}>👨‍⚕️ {record.creado_por_nombre}</Text>
        ) : null}
      </View>
      <Text style={{ color: C.muted, fontSize: 22 }}>›</Text>
    </TouchableOpacity>
  );
}

function RecordDetailModal({
  record,
  onClose,
}: {
  record: RecordItem | null;
  onClose: () => void;
}) {
  if (!record) return null;

  const openFile = async () => {
    if (!record.filepath) {
      Alert.alert('Sin archivo', 'Esta ficha no tiene archivo adjunto.');
      return;
    }
    const url = /^https?:\/\//i.test(record.filepath)
      ? record.filepath
      : `${API_BASE}/${record.filepath.replace(/^\//, '')}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el archivo.');
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.recordIcon}>
                <Text style={{ fontSize: 28 }}>{getRecordIcon(record.tipo)}</Text>
              </View>
              <Text style={S.h2}>{displayTipo(record)}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={{ color: C.subtext, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailRow}>
              <Text style={S.label}>FECHA</Text>
              <Text style={[S.body, { marginTop: 3 }]}>{formatDate(record)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={S.label}>PESO</Text>
              <Text style={[S.body, { marginTop: 3 }]}>
                {record.peso != null ? `${Number(record.peso).toFixed(2)} kg` : '—'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={S.label}>TEMPERATURA</Text>
              <Text style={[S.body, { marginTop: 3 }]}>
                {record.temperatura != null ? `${Number(record.temperatura).toFixed(1)} °C` : '—'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={S.label}>ATENDIDO POR</Text>
              <Text style={[S.body, { marginTop: 3 }]}>{record.creado_por_nombre || '—'}</Text>
            </View>

            {record.nota ? (
              <View style={{ marginTop: 4 }}>
                <Text style={[S.label, { marginBottom: 8 }]}>NOTAS / OBSERVACIONES</Text>
                <View style={S.cardElevated}>
                  <Text style={S.body}>{record.nota}</Text>
                </View>
              </View>
            ) : null}

            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={{ gap: 8, marginTop: 14 }}>
            {record.filepath && (
              <TouchableOpacity style={S.btnPrimary} onPress={openFile}>
                <Text style={S.btnPrimaryText}>📎 Ver archivo adjunto</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={S.btnGhost} onPress={onClose}>
              <Text style={S.btnGhostText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function HistorialMedicoScreen() {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mascotas, setMascotas]     = useState<Mascota[]>([]);
  const [recordsByPet, setRecordsByPet] = useState<Record<string, RecordItem[]>>({});
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  useEffect(() => { loadAll(); }, []);

  // silent=true refresca sin desmontar la pantalla (pull-to-refresh)
  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const p = await getCurrentPropietario();
      if (!p?.id) {
        Alert.alert('Sesión expirada', 'Vuelve a iniciar sesión.');
        router.replace('/');
        return;
      }
      const pets = await getMascotasByPropietario(p.id);
      setMascotas(pets || []);

      const results = await Promise.all(
        (pets || []).map(async (pet: Mascota) => {
          try {
            const res = await api.get(`/medical-records?pet_id=${pet.id}`);
            return { petId: pet.id, data: res.data?.data || [] };
          } catch {
            return { petId: pet.id, data: [] };
          }
        })
      );

      const map: Record<string, RecordItem[]> = {};
      for (const r of results) map[String(r.petId)] = r.data;
      setRecordsByPet(map);
    } catch {
      if (!silent) Alert.alert('Error', 'No se pudo cargar el historial médico.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll(true).finally(() => setRefreshing(false));
  };

  const totalRecords = Object.values(recordsByPet).reduce((acc, r) => acc + r.length, 0);

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[S.small, { marginTop: 12 }]}>Cargando historial médico...</Text>
      </View>
    );
  }

  return (
    <View style={S.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.accent, fontSize: 16, fontWeight: '600' }}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={S.h2}>Historial médico</Text>
        <Text style={S.small}>{totalRecords} ficha{totalRecords !== 1 ? 's' : ''} en total</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Acceso al libro de vacunas */}
        <TouchableOpacity
          style={styles.vacunasBanner}
          onPress={() => router.push('/libro-vacunas')}
          activeOpacity={0.8}
        >
          <View style={styles.vacunasBannerIcon}>
            <Text style={{ fontSize: 24 }}>💉</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={S.h3}>Libro de vacunas</Text>
            <Text style={S.small}>Dosis aplicadas, ciclos y próximas vacunas</Text>
          </View>
          <Text style={{ color: C.muted, fontSize: 22 }}>›</Text>
        </TouchableOpacity>

        {mascotas.length === 0 ? (
          <View style={[S.card, { alignItems: 'center', paddingVertical: 48 }]}>
            <Text style={{ fontSize: 44, marginBottom: 14 }}>🏥</Text>
            <Text style={S.h3}>Sin registros médicos</Text>
            <Text style={[S.small, { marginTop: 8, textAlign: 'center' }]}>
              Aún no tienes fichas médicas registradas.
            </Text>
          </View>
        ) : (
          mascotas.map(pet => {
            const records = recordsByPet[String(pet.id)] || [];
            return (
              <View key={pet.id} style={{ marginBottom: 24 }}>
                {/* Encabezado de mascota */}
                <View style={styles.petHeader}>
                  <Text style={{ fontSize: 22 }}>{getSpeciesIcon(pet.especie)}</Text>
                  <View>
                    <Text style={S.h3}>{pet.nombre || `Mascota ${pet.id}`}</Text>
                    <Text style={S.small}>
                      {records.length} ficha{records.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {records.length === 0 ? (
                  <View style={[S.cardElevated, { alignItems: 'center', paddingVertical: 20 }]}>
                    <Text style={S.small}>Sin fichas médicas registradas.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {records.map(r => (
                      <RecordCard
                        key={r.id}
                        record={r}
                        onPress={() => setSelectedRecord(r)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 6,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  vacunasBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  vacunasBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingLeft: 4,
  },
  recordCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  recordIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white05,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
});
