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
    View,
} from 'react-native';
import { C, S, SPECIES_ICONS } from '../constants/theme';
import {
    getCurrentPropietario,
    getMascotasByPropietario,
    getVacunasByMascota,
} from '../services/api';

type Mascota = { id: number; nombre?: string; especie?: string; [k: string]: any };
type Vacuna = {
  id: number;
  mascota_id: number;
  nombre_vacuna?: string;
  producto?: string | null;
  lote?: string | null;
  fecha_aplicacion?: string | null;
  fecha_proxima?: string | null;
  fecha_aplicacion_display?: string;
  fecha_proxima_display?: string;
  estado?: string;
  dias_restantes?: number | null;
  ciclo_completado?: number | boolean;
  veterinario_nombre?: string | null;
  notas?: string | null;
  [k: string]: any;
};

// Estados calculados por el API (computeEstado en vacunasController)
const ESTADO_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  vigente:     { label: 'Vigente',           icon: '🛡️', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)'  },
  proxima:     { label: 'Vence pronto',      icon: '⏰', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)'  },
  vencida:     { label: 'Vencida',           icon: '⚠️', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)'   },
  completado:  { label: 'Ciclo completado',  icon: '✓',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
  sin_proxima: { label: 'Sin próxima dosis', icon: '➖', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)'  },
};

const getEstadoCfg = (estado?: string) =>
  ESTADO_CONFIG[(estado || '').toLowerCase()] ?? ESTADO_CONFIG.sin_proxima;

const getSpeciesIcon = (especie?: string) =>
  SPECIES_ICONS[(especie || '').toLowerCase()] ?? '🐾';

// Texto amigable a partir de dias_restantes que calcula el API
function diasTexto(v: Vacuna): string | null {
  const dias = v.dias_restantes;
  if (dias == null) return null;
  const estado = (v.estado || '').toLowerCase();
  if (estado === 'vencida') {
    const d = Math.abs(dias);
    return `Venció hace ${d} día${d !== 1 ? 's' : ''}`;
  }
  if (estado === 'proxima') {
    if (dias === 0) return 'La próxima dosis vence HOY';
    return `Próxima dosis en ${dias} día${dias !== 1 ? 's' : ''}`;
  }
  if (estado === 'vigente') {
    return `Próxima dosis en ${dias} día${dias !== 1 ? 's' : ''}`;
  }
  return null;
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado?: string }) {
  const cfg = getEstadoCfg(estado);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
      backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border,
    }}>
      <Text style={{ fontSize: 11 }}>{cfg.icon}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

function VacunaCard({ vacuna, onPress }: { vacuna: Vacuna; onPress: () => void }) {
  const cfg = getEstadoCfg(vacuna.estado);
  const infoDias = diasTexto(vacuna);
  const completado = (vacuna.estado || '').toLowerCase() === 'completado';

  return (
    <TouchableOpacity
      style={[styles.vacunaCard, { borderLeftWidth: 3, borderLeftColor: cfg.color }, completado && { opacity: 0.75 }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.vacunaIcon}>
        <Text style={{ fontSize: 22 }}>💉</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={[S.h3, { flex: 1 }]} numberOfLines={1}>{vacuna.nombre_vacuna || 'Vacuna'}</Text>
          <EstadoBadge estado={vacuna.estado} />
        </View>
        {vacuna.producto ? <Text style={S.small}>🧪 {vacuna.producto}</Text> : null}
        <Text style={S.small}>📅 Aplicada: {vacuna.fecha_aplicacion_display || '—'}</Text>
        {vacuna.fecha_proxima ? (
          <Text style={S.small}>🔁 Próxima dosis: {vacuna.fecha_proxima_display || '—'}</Text>
        ) : null}
        {infoDias ? (
          <Text style={[S.small, { marginTop: 2, fontWeight: '700', color: cfg.color }]}>{infoDias}</Text>
        ) : null}
        {vacuna.veterinario_nombre ? (
          <Text style={[S.small, { marginTop: 2 }]}>👨‍⚕️ Dr. {vacuna.veterinario_nombre}</Text>
        ) : null}
      </View>
      <Text style={{ color: C.muted, fontSize: 22 }}>›</Text>
    </TouchableOpacity>
  );
}

function VacunaDetailModal({
  vacuna,
  onClose,
}: {
  vacuna: Vacuna | null;
  onClose: () => void;
}) {
  if (!vacuna) return null;
  const cfg = getEstadoCfg(vacuna.estado);
  const infoDias = diasTexto(vacuna);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={styles.vacunaIcon}>
                <Text style={{ fontSize: 28 }}>💉</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.h2} numberOfLines={2}>{vacuna.nombre_vacuna || 'Vacuna'}</Text>
                <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                  <EstadoBadge estado={vacuna.estado} />
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={{ color: C.subtext, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {infoDias ? (
              <View style={[styles.diasBanner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: cfg.color }}>{infoDias}</Text>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <Text style={S.label}>FECHA DE APLICACIÓN</Text>
              <Text style={[S.body, { marginTop: 3 }]}>{vacuna.fecha_aplicacion_display || '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={S.label}>PRÓXIMA DOSIS</Text>
              <Text style={[S.body, { marginTop: 3 }]}>{vacuna.fecha_proxima_display || '—'}</Text>
            </View>
            {vacuna.producto ? (
              <View style={styles.detailRow}>
                <Text style={S.label}>PRODUCTO</Text>
                <Text style={[S.body, { marginTop: 3 }]}>{vacuna.producto}</Text>
              </View>
            ) : null}
            {vacuna.lote ? (
              <View style={styles.detailRow}>
                <Text style={S.label}>LOTE</Text>
                <Text style={[S.body, { marginTop: 3 }]}>{vacuna.lote}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={S.label}>APLICADA POR</Text>
              <Text style={[S.body, { marginTop: 3 }]}>
                {vacuna.veterinario_nombre ? `Dr. ${vacuna.veterinario_nombre}` : '—'}
              </Text>
            </View>

            {vacuna.notas ? (
              <View style={{ marginTop: 12 }}>
                <Text style={[S.label, { marginBottom: 8 }]}>NOTAS</Text>
                <View style={S.cardElevated}>
                  <Text style={S.body}>{vacuna.notas}</Text>
                </View>
              </View>
            ) : null}

            <View style={{ height: 16 }} />
          </ScrollView>

          <TouchableOpacity style={[S.btnGhost, { marginTop: 14 }]} onPress={onClose}>
            <Text style={S.btnGhostText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function LibroVacunasScreen() {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mascotas, setMascotas]     = useState<Mascota[]>([]);
  const [vacunasByPet, setVacunasByPet] = useState<Record<string, Vacuna[]>>({});
  const [selected, setSelected]     = useState<Vacuna | null>(null);

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
            const data = await getVacunasByMascota(pet.id);
            return { petId: pet.id, data: data || [] };
          } catch {
            return { petId: pet.id, data: [] };
          }
        })
      );

      const map: Record<string, Vacuna[]> = {};
      for (const r of results) map[String(r.petId)] = r.data;
      setVacunasByPet(map);
    } catch {
      if (!silent) Alert.alert('Error', 'No se pudo cargar el libro de vacunas.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll(true).finally(() => setRefreshing(false));
  };

  const totalVacunas = Object.values(vacunasByPet).reduce((acc, v) => acc + v.length, 0);

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[S.small, { marginTop: 12 }]}>Cargando libro de vacunas...</Text>
      </View>
    );
  }

  return (
    <View style={S.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.accent, fontSize: 16, fontWeight: '600' }}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={S.h2}>💉 Libro de vacunas</Text>
        <Text style={S.small}>{totalVacunas} registro{totalVacunas !== 1 ? 's' : ''} en total</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {mascotas.length === 0 ? (
          <View style={[S.card, { alignItems: 'center', paddingVertical: 48 }]}>
            <Text style={{ fontSize: 44, marginBottom: 14 }}>💉</Text>
            <Text style={S.h3}>Sin registros de vacunas</Text>
            <Text style={[S.small, { marginTop: 8, textAlign: 'center' }]}>
              Aún no tienes mascotas registradas.
            </Text>
          </View>
        ) : (
          mascotas.map(pet => {
            const vacunas = vacunasByPet[String(pet.id)] || [];
            return (
              <View key={pet.id} style={{ marginBottom: 24 }}>
                {/* Encabezado de mascota */}
                <View style={styles.petHeader}>
                  <Text style={{ fontSize: 22 }}>{getSpeciesIcon(pet.especie)}</Text>
                  <View>
                    <Text style={S.h3}>{pet.nombre || `Mascota ${pet.id}`}</Text>
                    <Text style={S.small}>
                      {vacunas.length} vacuna{vacunas.length !== 1 ? 's' : ''} registrada{vacunas.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {vacunas.length === 0 ? (
                  <View style={[S.cardElevated, { alignItems: 'center', paddingVertical: 20 }]}>
                    <Text style={S.small}>Sin vacunas registradas.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {vacunas.map(v => (
                      <VacunaCard
                        key={v.id}
                        vacuna={v}
                        onPress={() => setSelected(v)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <VacunaDetailModal vacuna={selected} onClose={() => setSelected(null)} />
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
  petHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingLeft: 4,
  },
  vacunaCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  vacunaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white05,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diasBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
});
