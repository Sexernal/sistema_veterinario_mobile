import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { C, S, SPECIES_ICONS, STATUS_MAP, TIPO_MAP } from '../constants/theme';
import api, {
  getCitasByPropietario,
  getCurrentPropietario,
  getMascotasByPropietario,
} from '../services/api';

type Propietario = { id: number; nombre?: string; [k: string]: any };
type Mascota     = { id: number; nombre: string; especie?: string; [k: string]: any };
type Cita        = {
  id: number;
  mascota_id: number;
  fecha_inicio: string;
  duracion_min: number;
  tipo_consulta?: string;
  mascota_nombre?: string;
  veterinario_id?: number;
  veterinario_nombre?: string;
  estado?: string;
  motivo?: string;
  [k: string]: any;
};
type Slot = { timeStr: string; startIsoLocal: string };

const TIPOS = Object.keys(TIPO_MAP);

const pad  = (n: number) => String(n).padStart(2, '0');
const dateToYMD = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toSQLDatetime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.replace('T', ' ') + ':00';
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};
const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CR', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ estado }: { estado?: string }) {
  const cfg = STATUS_MAP[(estado || '').toLowerCase()] ?? STATUS_MAP.pendiente;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 999, backgroundColor: cfg.bg,
      borderWidth: 1, borderColor: cfg.border,
    }}>
      <Text style={{ fontSize: 11 }}>{cfg.icon}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

// ─── CitaCard ─────────────────────────────────────────────────────────────────

function CitaCard({ cita, onPress }: { cita: Cita; onPress: () => void }) {
  const tipo = TIPO_MAP[(cita.tipo_consulta || '').toLowerCase()];
  return (
    <TouchableOpacity style={styles.citaCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.tipoIcon}>
        <Text style={{ fontSize: 22 }}>{tipo?.icon ?? '📅'}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={S.h3}>{cita.mascota_nombre || '—'}</Text>
          <StatusBadge estado={cita.estado} />
        </View>
        <Text style={S.small}>{tipo?.label ?? cita.tipo_consulta ?? '—'} · {cita.duracion_min} min</Text>
        <Text style={S.small}>📆 {formatDateTime(cita.fecha_inicio)}</Text>
        {cita.veterinario_nombre && (
          <Text style={S.small}>👨‍⚕️ {cita.veterinario_nombre}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function AgendarCitaScreen() {
  const [loading, setLoading]   = useState(true);
  const [user, setUser]         = useState<Propietario | null>(null);
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [citas, setCitas]       = useState<Cita[]>([]);
  const [veterinarios, setVeterinarios] = useState<any[]>([]);
  const [showCreate, setShowCreate]     = useState(false);
  const [detailCita, setDetailCita]     = useState<Cita | null>(null);

  // Form
  const [selectedMascotaId, setSelectedMascotaId]     = useState<number | null>(null);
  const [selectedVetId, setSelectedVetId]             = useState<number | null>(null);
  const [tipoConsulta, setTipoConsulta]               = useState('consulta general');
  const [selectedDate, setSelectedDate]               = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker]           = useState(false);
  const [slotSelected, setSlotSelected]               = useState<string | null>(null);
  const [duracionMin, setDuracionMin]                 = useState(30);
  const [motivo, setMotivo]                           = useState('');
  const [slotsByVet, setSlotsByVet]                   = useState<Record<string, Slot[]>>({});
  const [slotsLoading, setSlotsLoading]               = useState(false);
  const [creating, setCreating]                       = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const p = await getCurrentPropietario();
        setUser(p);
        if (p?.id) {
          const [m, c] = await Promise.all([
            getMascotasByPropietario(p.id).catch(() => []),
            getCitasByPropietario(p.id).catch(() => []),
          ]);
          setMascotas(m || []);
          setCitas(c || []);
        }
        try {
          const uRes = await api.get('/users?page=1&limit=500');
          setVeterinarios(
            (uRes.data?.data || []).filter((u: any) => (u.role || '').toLowerCase() === 'admin')
          );
        } catch {
          setVeterinarios([]);
        }
      } catch {
        Alert.alert('Error', 'No se pudieron cargar los datos.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Duración automática al cambiar tipo
  useEffect(() => {
    setDuracionMin(TIPO_MAP[(tipoConsulta || '').toLowerCase()]?.durationMin ?? 30);
    setSlotSelected(null);
    setSlotsByVet({});
  }, [tipoConsulta]);

  // Auto-fetch slots al cambiar fecha (igual que el web)
  useEffect(() => {
    if (!selectedDate) return;
    fetchSlots(selectedDate);
  }, [selectedDate, tipoConsulta, selectedVetId]);

  const fetchSlots = async (date: Date) => {
    const fechaStr = dateToYMD(date);
    setSlotsLoading(true);
    setSlotsByVet({});
    setSlotSelected(null);
    try {
      const q = `/citas/slots?date=${encodeURIComponent(fechaStr)}&tipo=${encodeURIComponent(tipoConsulta)}${selectedVetId ? `&veterinario_id=${selectedVetId}` : ''}`;
      const res = await api.get(q);
      if (mountedRef.current) {
        setSlotsByVet(
          res.data?.success && res.data?.data?.slotsByVet
            ? res.data.data.slotsByVet
            : {}
        );
      }
    } catch {
      if (mountedRef.current) {
        Alert.alert('Sin horarios', 'No se pudieron obtener los horarios disponibles. Intenta con otra fecha.');
        setSlotsByVet({});
      }
    } finally {
      if (mountedRef.current) setSlotsLoading(false);
    }
  };

  const onDateChange = (_: any, picked?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (!picked) return;

    const pick = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (pick < tomorrow) {
      Alert.alert('Fecha no válida', 'Solo se pueden agendar citas desde mañana en adelante.');
      return;
    }
    if (pick.getDay() === 0) {
      Alert.alert('Fecha no válida', 'La clínica está cerrada los domingos.');
      return;
    }
    setSelectedDate(pick);
  };

  const refreshCitas = async () => {
    if (!user?.id) return;
    try {
      setCitas((await getCitasByPropietario(user.id)) || []);
    } catch {}
  };

  const resetForm = () => {
    setSelectedMascotaId(null);
    setSelectedVetId(null);
    setTipoConsulta('consulta general');
    setSelectedDate(null);
    setSlotSelected(null);
    setMotivo('');
    setSlotsByVet({});
  };

  const validateAndCreate = async () => {
    if (!user?.id)             return Alert.alert('Error', 'No estás autenticado.');
    if (!selectedMascotaId)    return Alert.alert('Mascota requerida', 'Selecciona una mascota.');
    if (!selectedDate)         return Alert.alert('Fecha requerida', 'Selecciona una fecha.');
    if (!slotSelected)         return Alert.alert('Horario requerido', 'Selecciona una franja horaria.');
    if (new Date(slotSelected) < new Date())
      return Alert.alert('Hora inválida', 'No puedes agendar en el pasado.');

    setCreating(true);
    try {
      const payload = {
        mascota_id:     Number(selectedMascotaId),
        propietario_id: Number(user.id),
        veterinario_id: selectedVetId ? Number(selectedVetId) : null,
        tipo_consulta:  tipoConsulta,
        motivo:         motivo || null,
        fecha_inicio:   toSQLDatetime(slotSelected),
        duracion_min:   Number(duracionMin),
      };
      await api.post('/citas', payload);
      Alert.alert('¡Cita agendada!', 'Tu cita fue creada correctamente.');
      setShowCreate(false);
      resetForm();
      await refreshCitas();
    } catch (err: any) {
      const msg = err?.response?.status === 409
        ? (err.response.data?.message || 'Ese horario ya está ocupado. Elige otro.')
        : (err?.response?.data?.message || 'Error al crear la cita.');
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[S.small, { marginTop: 12 }]}>Cargando...</Text>
      </View>
    );
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <View style={S.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.accent, fontSize: 16, fontWeight: '600' }}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={S.h2}>Mis citas</Text>
        <Text style={S.small}>{citas.length} cita{citas.length !== 1 ? 's' : ''} en total</Text>
      </View>

      {/* Botón crear */}
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity style={S.btnPrimary} onPress={() => setShowCreate(true)}>
          <Text style={S.btnPrimaryText}>+ Agendar nueva cita</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de citas */}
      <FlatList
        data={citas}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={[S.card, { alignItems: 'center', paddingVertical: 40 }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
            <Text style={S.h3}>Sin citas registradas</Text>
            <Text style={[S.small, { marginTop: 6, textAlign: 'center' }]}>
              Agenda tu primera cita pulsando el botón de arriba.
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <CitaCard cita={item} onPress={() => setDetailCita(item)} />
        )}
      />

      {/* ── Modal Crear Cita ── */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => { setShowCreate(false); resetForm(); }}>
        <View style={[S.screen, { paddingTop: 0 }]}>
          {/* Header modal */}
          <View style={styles.modalHeader}>
            <Text style={S.h2}>Nueva cita</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => { setShowCreate(false); resetForm(); }}
            >
              <Text style={{ color: C.subtext, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mascota */}
            <Text style={[S.label, { marginBottom: 8 }]}>MASCOTA</Text>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {mascotas.length === 0 ? (
                <Text style={S.small}>No tienes mascotas registradas.</Text>
              ) : mascotas.map(m => {
                const selected = selectedMascotaId === m.id;
                const icon = SPECIES_ICONS[(m.especie || '').toLowerCase()] ?? '🐾';
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.selectorOption, selected && styles.selectorSelected]}
                    onPress={() => setSelectedMascotaId(m.id)}
                  >
                    <Text style={{ fontSize: 20 }}>{icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[S.body, selected && { color: C.accent, fontWeight: '700' }]}>
                        {m.nombre}
                      </Text>
                      {m.especie && <Text style={S.small}>{m.especie}</Text>}
                    </View>
                    {selected && <Text style={{ color: C.accent }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Veterinario */}
            <Text style={[S.label, { marginBottom: 8 }]}>VETERINARIO (opcional)</Text>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {[{ id: null, label: '— Cualquiera —', sub: 'Se asignará automáticamente' },
                ...veterinarios.map(v => ({ id: v.id, label: v.nombre, sub: v.email }))
              ].map(v => {
                const selected = selectedVetId === v.id;
                return (
                  <TouchableOpacity
                    key={String(v.id)}
                    style={[styles.selectorOption, selected && styles.selectorSelected]}
                    onPress={() => setSelectedVetId(v.id)}
                  >
                    <Text style={{ fontSize: 20 }}>👨‍⚕️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[S.body, selected && { color: C.accent, fontWeight: '700' }]}>
                        {v.label}
                      </Text>
                      {v.sub && <Text style={S.small}>{v.sub}</Text>}
                    </View>
                    {selected && <Text style={{ color: C.accent }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tipo de consulta */}
            <Text style={[S.label, { marginBottom: 8 }]}>TIPO DE CONSULTA</Text>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {TIPOS.map(t => {
                const cfg = TIPO_MAP[t];
                const selected = tipoConsulta === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.selectorOption, selected && styles.selectorSelected]}
                    onPress={() => setTipoConsulta(t)}
                  >
                    <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[S.body, selected && { color: C.accent, fontWeight: '700' }]}>
                        {cfg.label}
                      </Text>
                      <Text style={S.small}>{cfg.durationMin} min</Text>
                    </View>
                    {selected && <Text style={{ color: C.accent }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Fecha */}
            <Text style={[S.label, { marginBottom: 8 }]}>FECHA</Text>
            <TouchableOpacity
              style={[S.cardElevated, styles.datePicker]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ fontSize: 24 }}>📅</Text>
              <Text style={[S.body, !selectedDate && { color: C.muted }]}>
                {selectedDate
                  ? selectedDate.toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Selecciona una fecha (lun–sáb)'}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate ?? tomorrow}
                mode="date"
                display="default"
                minimumDate={tomorrow}
                onChange={onDateChange}
              />
            )}

            {/* Slots */}
            {selectedDate && (
              <>
                <Text style={[S.label, { marginTop: 20, marginBottom: 8 }]}>HORARIOS DISPONIBLES</Text>
                {slotsLoading ? (
                  <View style={[S.cardElevated, { alignItems: 'center', padding: 24 }]}>
                    <ActivityIndicator color={C.accent} />
                    <Text style={[S.small, { marginTop: 8 }]}>Buscando horarios...</Text>
                  </View>
                ) : Object.keys(slotsByVet).length === 0 ? (
                  <View style={[S.cardElevated, { alignItems: 'center', padding: 24 }]}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>😔</Text>
                    <Text style={S.small}>Sin horarios disponibles para esta fecha y tipo.</Text>
                    <Text style={[S.small, { marginTop: 4 }]}>Prueba otra fecha o cambia el tipo.</Text>
                  </View>
                ) : (
                  Object.entries(slotsByVet).map(([vid, slots]) => {
                    const vet = veterinarios.find(v => String(v.id) === String(vid));
                    return (
                      <View key={vid} style={[S.card, { marginBottom: 12 }]}>
                        <Text style={[S.body, { fontWeight: '700', marginBottom: 12 }]}>
                          👨‍⚕️ {vet?.nombre ?? `Veterinario ${vid}`}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {(slots as Slot[]).map(s => {
                            const isSelected = slotSelected === s.startIsoLocal;
                            return (
                              <TouchableOpacity
                                key={s.startIsoLocal}
                                style={[styles.slotBtn, isSelected && styles.slotBtnSelected]}
                                onPress={() => {
                                  setSlotSelected(s.startIsoLocal);
                                  if (!selectedVetId) setSelectedVetId(Number(vid));
                                }}
                              >
                                <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                                  {s.timeStr}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}

            {/* Motivo */}
            <Text style={[S.label, { marginTop: 20, marginBottom: 8 }]}>MOTIVO (opcional)</Text>
            <TextInput
              style={[S.input, { height: 80, textAlignVertical: 'top' }]}
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ej: revisión anual, vacuna pendiente..."
              placeholderTextColor={C.muted}
              multiline
            />

            {/* Botones */}
            <View style={{ gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[S.btnPrimary, creating && { opacity: 0.6 }]}
                onPress={validateAndCreate}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color={C.accentText} />
                  : <Text style={S.btnPrimaryText}>Confirmar cita</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={S.btnGhost}
                onPress={() => { setShowCreate(false); resetForm(); }}
                disabled={creating}
              >
                <Text style={S.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal Detalle Cita ── */}
      {detailCita && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setDetailCita(null)}>
          <View style={S.modalOverlay}>
            <View style={S.modalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.tipoIcon}>
                    <Text style={{ fontSize: 26 }}>
                      {TIPO_MAP[(detailCita.tipo_consulta || '').toLowerCase()]?.icon ?? '📅'}
                    </Text>
                  </View>
                  <View>
                    <Text style={S.h3}>{detailCita.mascota_nombre || '—'}</Text>
                    <StatusBadge estado={detailCita.estado} />
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailCita(null)}>
                  <Text style={{ color: C.subtext, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <DetailRow label="TIPO" value={TIPO_MAP[(detailCita.tipo_consulta || '').toLowerCase()]?.label ?? detailCita.tipo_consulta ?? '—'} />
                <DetailRow label="FECHA Y HORA" value={formatDateTime(detailCita.fecha_inicio)} />
                <DetailRow label="DURACIÓN" value={`${detailCita.duracion_min} min`} />
                <DetailRow label="VETERINARIO" value={detailCita.veterinario_nombre || '—'} />
                {detailCita.motivo && <DetailRow label="MOTIVO" value={detailCita.motivo} />}
                <View style={{ height: 8 }} />
              </ScrollView>

              <TouchableOpacity style={[S.btnGhost, { marginTop: 14 }]} onPress={() => setDetailCita(null)}>
                <Text style={S.btnGhostText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={S.label}>{label}</Text>
      <Text style={[S.body, { marginTop: 3 }]}>{value}</Text>
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 56,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 4,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.white05,
    justifyContent: 'center', alignItems: 'center',
  },
  citaCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: C.border,
  },
  tipoIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.bgElevated,
    borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  selectorOption: {
    backgroundColor: C.bgElevated,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  selectorSelected: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  slotBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  slotBtnSelected: {
    backgroundColor: C.accentBg,
    borderColor: C.accent,
  },
  slotText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.subtext,
  },
  slotTextSelected: {
    color: C.accent,
  },
});