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
  grupo_id?: number;
  dosis_numero?: number;
  total_dosis?: number;
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

// Una serie de vacunación: todas las dosis que comparten grupo_id
type Serie = {
  grupoId: number;
  nombre: string;
  dosis: Vacuna[];   // de la más reciente a la más antigua
  actual: Vacuna;
  total: number;
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

// Agrupa las dosis por serie de vacuna (grupo_id que asigna el API)
function agruparPorSerie(vacunas: Vacuna[]): Serie[] {
  const map = new Map<number, Vacuna[]>();
  for (const v of vacunas) {
    const g = v.grupo_id ?? v.id;
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(v);
  }

  const series: Serie[] = [];
  map.forEach((lista, grupoId) => {
    const dosis = lista.slice().sort((a, b) => {
      const fa = a.fecha_aplicacion || '';
      const fb = b.fecha_aplicacion || '';
      if (fa !== fb) return fa < fb ? 1 : -1;
      return b.id - a.id;
    });
    series.push({
      grupoId,
      nombre: dosis[0].nombre_vacuna || 'Vacuna',
      dosis,
      actual: dosis[0],
      total: dosis.length,
    });
  });

  // Primero lo que requiere atención
  const prioridad: Record<string, number> = { vencida: 0, proxima: 1, vigente: 2, sin_proxima: 3, completado: 4 };
  series.sort((a, b) => {
    const pa = prioridad[(a.actual.estado || '').toLowerCase()] ?? 9;
    const pb = prioridad[(b.actual.estado || '').toLowerCase()] ?? 9;
    if (pa !== pb) return pa - pb;
    return (b.actual.fecha_aplicacion || '').localeCompare(a.actual.fecha_aplicacion || '');
  });
  return series;
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

// Tarjeta de una serie de vacuna, con su historial de dosis desplegable
function SerieCard({
  serie,
  expandida,
  onToggle,
  onVerDosis,
}: {
  serie: Serie;
  expandida: boolean;
  onToggle: () => void;
  onVerDosis: (v: Vacuna) => void;
}) {
  const actual = serie.actual;
  const cfg = getEstadoCfg(actual.estado);
  const infoDias = diasTexto(actual);
  const completado = (actual.estado || '').toLowerCase() === 'completado';

  return (
    <View style={[styles.serieCard, { borderLeftWidth: 3, borderLeftColor: cfg.color }, completado && { opacity: 0.8 }]}>
      {/* Encabezado de la serie */}
      <TouchableOpacity style={styles.serieHeader} onPress={onToggle} activeOpacity={0.75}>
        <View style={styles.vacunaIcon}>
          <Text style={{ fontSize: 22 }}>💉</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={[S.h3, { flex: 1 }]} numberOfLines={1}>{serie.nombre}</Text>
            <View style={styles.dosisChip}>
              <Text style={styles.dosisChipText}>
                {serie.total} {serie.total === 1 ? 'dosis' : 'dosis'}
              </Text>
            </View>
          </View>
          <View style={{ alignSelf: 'flex-start' }}>
            <EstadoBadge estado={actual.estado} />
          </View>
          <Text style={S.small}>📅 Última: {actual.fecha_aplicacion_display || '—'}</Text>
          {actual.fecha_proxima ? (
            <Text style={S.small}>🔁 Próxima: {actual.fecha_proxima_display || '—'}</Text>
          ) : null}
          {infoDias ? (
            <Text style={[S.small, { fontWeight: '700', color: cfg.color }]}>{infoDias}</Text>
          ) : null}
        </View>
        <Text style={{ color: C.muted, fontSize: 16 }}>{expandida ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Historial de dosis */}
      {expandida && (
        <View style={styles.historial}>
          {serie.dosis.map((v, idx) => {
            const numero = serie.total - idx;
            const vCfg = getEstadoCfg(v.estado);
            const esActual = idx === 0;
            return (
              <TouchableOpacity
                key={v.id}
                style={[styles.dosisRow, esActual && { backgroundColor: 'rgba(255,255,255,0.03)' }]}
                onPress={() => onVerDosis(v)}
                activeOpacity={0.7}
              >
                <View style={[styles.dosisNum, { borderColor: vCfg.border, backgroundColor: vCfg.bg }]}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: vCfg.color }}>{numero}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[S.body, { fontWeight: '700', fontSize: 13 }]}>
                      {numero}ª dosis · {v.fecha_aplicacion_display || '—'}
                    </Text>
                    {esActual && serie.total > 1 && (
                      <Text style={{ fontSize: 9.5, fontWeight: '800', color: C.accent }}>ACTUAL</Text>
                    )}
                  </View>
                  <Text style={[S.small, { color: vCfg.color, fontWeight: '600' }]}>
                    {getEstadoCfg(v.estado).icon} {getEstadoCfg(v.estado).label}
                  </Text>
                  {v.producto ? <Text style={S.small}>🧪 {v.producto}</Text> : null}
                </View>
                <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function VacunaDetailModal({
  vacuna,
  numero,
  total,
  onClose,
}: {
  vacuna: Vacuna | null;
  numero?: number;
  total?: number;
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
                {numero && total ? (
                  <Text style={[S.small, { marginTop: 2 }]}>Dosis {numero} de {total}</Text>
                ) : null}
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
  const [seriesByPet, setSeriesByPet] = useState<Record<string, Serie[]>>({});
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set());
  const [selected, setSelected]     = useState<{ v: Vacuna; numero: number; total: number } | null>(null);

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
            return { petId: pet.id, series: agruparPorSerie(data || []) };
          } catch {
            return { petId: pet.id, series: [] as Serie[] };
          }
        })
      );

      const map: Record<string, Serie[]> = {};
      for (const r of results) map[String(r.petId)] = r.series;
      setSeriesByPet(map);
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

  const toggleSerie = (grupoId: number) => {
    setExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(grupoId)) next.delete(grupoId); else next.add(grupoId);
      return next;
    });
  };

  const totalSeries = Object.values(seriesByPet).reduce((acc, s) => acc + s.length, 0);
  const totalDosis  = Object.values(seriesByPet)
    .reduce((acc, s) => acc + s.reduce((a, serie) => a + serie.total, 0), 0);

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
        <Text style={S.small}>
          {totalSeries} vacuna{totalSeries !== 1 ? 's' : ''} · {totalDosis} dosis registrada{totalDosis !== 1 ? 's' : ''}
        </Text>
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
            const series = seriesByPet[String(pet.id)] || [];
            return (
              <View key={pet.id} style={{ marginBottom: 24 }}>
                {/* Encabezado de mascota */}
                <View style={styles.petHeader}>
                  <Text style={{ fontSize: 22 }}>{getSpeciesIcon(pet.especie)}</Text>
                  <View>
                    <Text style={S.h3}>{pet.nombre || `Mascota ${pet.id}`}</Text>
                    <Text style={S.small}>
                      {series.length} vacuna{series.length !== 1 ? 's' : ''} registrada{series.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {series.length === 0 ? (
                  <View style={[S.cardElevated, { alignItems: 'center', paddingVertical: 20 }]}>
                    <Text style={S.small}>Sin vacunas registradas.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {series.map(serie => (
                      <SerieCard
                        key={serie.grupoId}
                        serie={serie}
                        expandida={expandidas.has(serie.grupoId)}
                        onToggle={() => toggleSerie(serie.grupoId)}
                        onVerDosis={(v) => {
                          const idx = serie.dosis.findIndex(d => d.id === v.id);
                          setSelected({ v, numero: serie.total - idx, total: serie.total });
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <VacunaDetailModal
        vacuna={selected?.v ?? null}
        numero={selected?.numero}
        total={selected?.total}
        onClose={() => setSelected(null)}
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
  petHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingLeft: 4,
  },
  serieCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  serieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  dosisChip: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.3)',
  },
  dosisChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
  },
  historial: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  dosisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  dosisNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
