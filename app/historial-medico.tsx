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
import api, {
  API_URL,
  getCurrentPropietario,
  getMascotasByPropietario,
  getTratamientosByMascota,
} from '../services/api';

type Mascota   = { id: number; nombre?: string; especie?: string; [k: string]: any };
type RecordItem = {
  id: number;
  mascota_id: number;
  tratamiento_id?: number | null;
  tratamiento_nombre?: string | null;
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

// Un tratamiento agrupa las consultas de un mismo episodio clínico:
// si al paciente le pidieron volver 3 días seguidos, esas 3 fichas van juntas.
type Tratamiento = {
  id: number;
  mascota_id: number;
  nombre: string;
  motivo?: string | null;
  estado?: string;
  total_fichas?: number;
  duracion_dias?: number | null;
  primera_ficha_display?: string;
  ultima_ficha_display?: string;
  [k: string]: any;
};

// Una entrada del historial: o un tratamiento con sus fichas, o una consulta suelta
type Entrada =
  | { kind: 'tratamiento'; key: string; orden: string; tratamiento: Tratamiento; fichas: RecordItem[] }
  | { kind: 'ficha';       key: string; orden: string; ficha: RecordItem };

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

// Estados que calcula el API para un tratamiento
const ESTADO_TRATAMIENTO: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  activo:     { label: 'En curso',   icon: '🔄', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)'  },
  finalizado: { label: 'Finalizado', icon: '✓',  color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)'  },
};

const getTratamientoCfg = (estado?: string) =>
  ESTADO_TRATAMIENTO[(estado || '').toLowerCase()] ?? ESTADO_TRATAMIENTO.activo;

// Rango de fechas que cubre el tratamiento, sin repetir la fecha si fue un solo día
function rangoTexto(t: Tratamiento): string {
  const desde = t.primera_ficha_display || '—';
  const hasta = t.ultima_ficha_display  || '—';
  return desde === hasta ? desde : `${desde} → ${hasta}`;
}

function duracionTexto(t: Tratamiento): string | null {
  if (t.duracion_dias == null) return null;
  if (t.duracion_dias === 0)   return 'mismo día';
  return `${t.duracion_dias} día${t.duracion_dias !== 1 ? 's' : ''}`;
}

// Arma la línea de tiempo del historial: mezcla tratamientos y consultas
// sueltas, ordenados por la actividad más reciente de cada uno.
// Mismo enfoque que agruparPorSerie en el libro de vacunas.
function agruparPorTratamiento(records: RecordItem[], tratamientos: Tratamiento[]): Entrada[] {
  const porId = new Map<number, { tratamiento: Tratamiento; fichas: RecordItem[] }>();
  for (const t of tratamientos) porId.set(Number(t.id), { tratamiento: t, fichas: [] });

  const entradas: Entrada[] = [];

  for (const r of records) {
    const grupo = r.tratamiento_id != null ? porId.get(Number(r.tratamiento_id)) : undefined;
    // Si la ficha apunta a un tratamiento que no vino en la respuesta,
    // se muestra suelta antes que desaparecer del historial.
    if (grupo) grupo.fichas.push(r);
    else entradas.push({ kind: 'ficha', key: `f${r.id}`, orden: r.fecha || '', ficha: r });
  }

  porId.forEach(({ tratamiento, fichas }) => {
    if (!fichas.length) return;
    // Dentro del tratamiento, la 1ª consulta va arriba
    fichas.sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
    entradas.push({
      kind: 'tratamiento',
      key: `t${tratamiento.id}`,
      orden: fichas[fichas.length - 1].fecha || '',
      tratamiento,
      fichas,
    });
  });

  return entradas.sort((a, b) => String(b.orden).localeCompare(String(a.orden)));
}

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

// Tarjeta de un tratamiento con sus consultas desplegables.
// Es solo lectura: el propietario ve la agrupación, no la modifica.
function TratamientoCard({
  tratamiento,
  fichas,
  expandido,
  onToggle,
  onVerFicha,
}: {
  tratamiento: Tratamiento;
  fichas: RecordItem[];
  expandido: boolean;
  onToggle: () => void;
  onVerFicha: (r: RecordItem) => void;
}) {
  const cfg      = getTratamientoCfg(tratamiento.estado);
  const duracion = duracionTexto(tratamiento);

  return (
    <View style={[styles.tratamientoCard, { borderLeftWidth: 3, borderLeftColor: cfg.color }]}>
      <TouchableOpacity style={styles.tratamientoHeader} onPress={onToggle} activeOpacity={0.75}>
        <View style={styles.tratamientoIcon}>
          <Text style={{ fontSize: 22 }}>🩺</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={[S.h3, { flex: 1 }]} numberOfLines={2}>{tratamiento.nombre}</Text>
            <View style={styles.fichasChip}>
              <Text style={styles.fichasChipText}>
                {fichas.length} ficha{fichas.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <View style={{ alignSelf: 'flex-start' }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border,
            }}>
              <Text style={{ fontSize: 11 }}>{cfg.icon}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={S.small}>
            📅 {rangoTexto(tratamiento)}{duracion ? ` · ${duracion}` : ''}
          </Text>
          {tratamiento.motivo ? (
            <Text numberOfLines={2} style={[S.small, { color: C.subtext }]}>
              {tratamiento.motivo}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: C.muted, fontSize: 16 }}>{expandido ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expandido && (
        <View style={styles.consultas}>
          {fichas.map((r, idx) => (
            <TouchableOpacity
              key={r.id}
              style={styles.consultaRow}
              onPress={() => onVerFicha(r)}
              activeOpacity={0.7}
            >
              <View style={[styles.consultaNum, { borderColor: cfg.border, backgroundColor: cfg.bg }]}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: cfg.color }}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[S.body, { fontWeight: '700', fontSize: 13 }]}>
                  {displayTipo(r)}
                </Text>
                <Text style={S.small}>📅 {formatDate(r)}</Text>
                {r.peso != null && (
                  <Text style={S.small}>⚖️ {Number(r.peso).toFixed(2)} kg</Text>
                )}
                {r.nota ? (
                  <Text numberOfLines={1} style={[S.small, { color: C.subtext }]}>{r.nota}</Text>
                ) : null}
              </View>
              <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
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
              <View style={{ flex: 1 }}>
                <Text style={S.h2}>{displayTipo(record)}</Text>
                {record.tratamiento_nombre ? (
                  <Text style={[S.small, { marginTop: 2, color: C.accent }]} numberOfLines={2}>
                    🩺 {record.tratamiento_nombre}
                  </Text>
                ) : null}
              </View>
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
  const [tratamientosByPet, setTratamientosByPet] = useState<Record<string, Tratamiento[]>>({});
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  // Los tratamientos arrancan desplegados; aquí guardamos los que el usuario cerró
  const [colapsados, setColapsados] = useState<Record<string, boolean>>({});

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
          // Las fichas son lo esencial; si los tratamientos fallan seguimos
          // mostrando el historial plano en vez de dejar la pantalla vacía.
          const [fichas, tratamientos] = await Promise.all([
            api.get(`/medical-records?pet_id=${pet.id}`)
              .then(res => res.data?.data || [])
              .catch(() => []),
            getTratamientosByMascota(pet.id).catch(() => []),
          ]);
          return { petId: pet.id, fichas, tratamientos };
        })
      );

      const mapFichas: Record<string, RecordItem[]>  = {};
      const mapTrat:   Record<string, Tratamiento[]> = {};
      for (const r of results) {
        mapFichas[String(r.petId)] = r.fichas;
        mapTrat[String(r.petId)]   = r.tratamientos;
      }
      setRecordsByPet(mapFichas);
      setTratamientosByPet(mapTrat);
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
            const records     = recordsByPet[String(pet.id)] || [];
            const tratamientos = tratamientosByPet[String(pet.id)] || [];
            const entradas    = agruparPorTratamiento(records, tratamientos);
            const numGrupos   = entradas.filter(e => e.kind === 'tratamiento').length;

            return (
              <View key={pet.id} style={{ marginBottom: 24 }}>
                {/* Encabezado de mascota */}
                <View style={styles.petHeader}>
                  <Text style={{ fontSize: 22 }}>{getSpeciesIcon(pet.especie)}</Text>
                  <View>
                    <Text style={S.h3}>{pet.nombre || `Mascota ${pet.id}`}</Text>
                    <Text style={S.small}>
                      {records.length} ficha{records.length !== 1 ? 's' : ''}
                      {numGrupos > 0
                        ? ` · ${numGrupos} tratamiento${numGrupos !== 1 ? 's' : ''}`
                        : ''}
                    </Text>
                  </View>
                </View>

                {records.length === 0 ? (
                  <View style={[S.cardElevated, { alignItems: 'center', paddingVertical: 20 }]}>
                    <Text style={S.small}>Sin fichas médicas registradas.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {entradas.map(e =>
                      e.kind === 'tratamiento' ? (
                        <TratamientoCard
                          key={e.key}
                          tratamiento={e.tratamiento}
                          fichas={e.fichas}
                          expandido={!colapsados[e.key]}
                          onToggle={() =>
                            setColapsados(c => ({ ...c, [e.key]: !c[e.key] }))
                          }
                          onVerFicha={setSelectedRecord}
                        />
                      ) : (
                        <RecordCard
                          key={e.key}
                          record={e.ficha}
                          onPress={() => setSelectedRecord(e.ficha)}
                        />
                      )
                    )}
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
  tratamientoCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  tratamientoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
  },
  tratamientoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fichasChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  fichasChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.subtext,
  },
  consultas: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  consultaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: C.bgElevated,
  },
  consultaNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
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
