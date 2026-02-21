// app/agendar-cita.tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
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
  View
} from 'react-native';
import api, {
  getCitasByPropietario,
  getCurrentPropietario,
  getMascotasByPropietario
} from '../services/api'; // usa tus exports existentes

type Propietario = { id: number; nombre?: string; email?: string; [k: string]: any; };
type Mascota = { id: number; nombre: string; owner_id?: number; especie?: string; raza?: string; [k: string]: any; };
type Cita = {
  id: number;
  mascota_id: number;
  propietario_id: number;
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

const formatDateToYYYYMMDD = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const formatDateTimeNice = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleString();
};

export default function AgendarCitaScreen() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Propietario | null>(null);
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [veterinarios, setVeterinarios] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [selectedMascotaId, setSelectedMascotaId] = useState<number | null>(null);
  const [selectedVeterinarioId, setSelectedVeterinarioId] = useState<number | null>(null);
  const [tipoConsulta, setTipoConsulta] = useState<string>('consulta general');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // date object (only date part)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [slotSelected, setSlotSelected] = useState<string | null>(null); // 'YYYY-MM-DDTHH:MM' or ISO
  const [duracionMin, setDuracionMin] = useState<number>(30);
  const [motivo, setMotivo] = useState<string>('');
  const [slotsByVet, setSlotsByVet] = useState<Record<string, Array<{ timeStr: string; startIsoLocal: string }>>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailCita, setDetailCita] = useState<Cita | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const p = await getCurrentPropietario();
        setUser(p);

        if (p?.id) {
          const [m, c] = await Promise.all([
            getMascotasByPropietario(p.id).catch(() => []),
            getCitasByPropietario(p.id).catch(() => [])
          ]);
          setMascotas(m || []);
          setCitas(c || []);
        }

        try {
          const uRes = await api.get('/users?page=1&limit=500');
          const users = uRes.data?.data || [];
          setVeterinarios((users || []).filter((u: any) => (u.role || '').toLowerCase() === 'admin'));
        } catch (err) {
          console.warn('No se pudieron cargar veterinarios (no crítico)', err);
          setVeterinarios([]);
        }
      } catch (err) {
        console.error('Error cargando datos iniciales', err);
        Alert.alert('Error', 'No se pudieron cargar datos. Vuelve a intentar.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const map: Record<string, number> = {
      'consulta general': 30,
      'vacunacion': 20,
      'urgencia': 60,
      'cirugia': 120,
      'peluqueria': 45,
      'control': 20,
      'desparacitacion': 15
    };
    setDuracionMin(map[(tipoConsulta || '').toLowerCase()] || 30);
    setSlotSelected(null);
  }, [tipoConsulta]);

  const refreshCitas = async () => {
    if (!user?.id) return;
    try {
      const c = await getCitasByPropietario(user.id);
      setCitas(c || []);
    } catch (err) {
      console.warn('Error refrescando citas', err);
    }
  };

  // Fecha: cuando el usuario selecciona en el date picker
  const onDateChange = (_: any, picked?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // en iOS keep open
    if (!picked) return;
    // normalizar (sacar horas)
    const pick = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrow = new Date(todayOnly.getTime() + 24 * 60 * 60 * 1000);

    if (pick < tomorrow) {
      // bloquear pasado y mismo día
      Alert.alert('Fecha no permitida', 'No se pueden agendar citas para hoy ni para días anteriores. Selecciona desde mañana en adelante.');
      return;
    }
    if (pick.getDay() === 0) {
      Alert.alert('Fecha inválida', 'La clínica está cerrada los domingos. Selecciona otro día.');
      return;
    }

    setSelectedDate(pick);
    setSlotSelected(null);
    setSlotsByVet({});
  };

  const fetchSlots = async () => {
    if (!selectedDate) { Alert.alert('Fecha requerida', 'Selecciona una fecha'); return; }
    const fechaInput = formatDateToYYYYMMDD(selectedDate);
    // segura: comprobar otra vez
    const d = new Date(`${fechaInput}T00:00:00`);
    if (isNaN(d.getTime())) { Alert.alert('Fecha inválida', 'Error con la fecha seleccionada'); return; }
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrow = new Date(todayOnly.getTime() + 24 * 60 * 60 * 1000);
    if (d < tomorrow) {
      Alert.alert('Fecha no permitida', 'No se pueden agendar citas para hoy ni para días anteriores. Selecciona desde mañana en adelante.');
      return;
    }
    if (d.getDay() === 0) {
      Alert.alert('Fecha inválida', 'La clínica está cerrada los domingos. Selecciona otro día.');
      return;
    }

    setSlotsLoading(true);
    setSlotsByVet({});
    try {
      const q = `/citas/slots?date=${encodeURIComponent(fechaInput)}&tipo=${encodeURIComponent(tipoConsulta)}${selectedVeterinarioId ? `&veterinario_id=${selectedVeterinarioId}` : ''}`;
      const res = await api.get(q);
      if (res.data && res.data.success && res.data.data && res.data.data.slotsByVet) {
        setSlotsByVet(res.data.data.slotsByVet);
      } else {
        // fallback: notificar al usuario
        Alert.alert('Aviso', 'No se encontraron franjas en el servidor. Intenta otra fecha o veterinario.');
        setSlotsByVet({});
      }
    } catch (err) {
      console.warn('Error fetching slots', err);
      Alert.alert('Error', 'No se pudieron obtener horarios desde el servidor. Revisa tu conexión o intenta otra fecha.');
    } finally {
      setSlotsLoading(false);
    }
  };

  const toSQLDatetime = (isoLocal: string | null) => {
    if (!isoLocal) return null;
    const d = new Date(isoLocal);
    if (!isNaN(d.getTime())) {
      const pad = (n:number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (isoLocal.includes('T')) return isoLocal.replace('T',' ') + ':00';
    return isoLocal;
  };

  const validateAndCreate = async () => {
    if (!user || !user.id) return Alert.alert('Error', 'No estás autenticado');
    if (!selectedMascotaId) return Alert.alert('Mascota requerida', 'Selecciona la mascota que recibirá la cita.');
    if (!selectedDate) return Alert.alert('Fecha requerida', 'Selecciona la fecha.');
    if (!slotSelected) return Alert.alert('Horario requerido', 'Selecciona una franja horaria disponible.');
    const slotDate = new Date(slotSelected);
    if (isNaN(slotDate.getTime())) return Alert.alert('Error fecha', 'Franja horaria inválida');
    if (slotDate.getTime() < Date.now()) return Alert.alert('Error hora', 'No puedes agendar en el pasado');

    setCreating(true);
    try {
      const payload = {
        mascota_id: Number(selectedMascotaId),
        propietario_id: Number(user.id),
        veterinario_id: selectedVeterinarioId ? Number(selectedVeterinarioId) : null,
        tipo_consulta: tipoConsulta,
        motivo: motivo || null,
        fecha_inicio: toSQLDatetime(slotSelected),
        duracion_min: Number(duracionMin)
      };
      const res = await api.post('/citas', payload);
      Alert.alert('Éxito', 'Cita creada correctamente');
      setShowCreateModal(false);
      setSelectedMascotaId(null);
      setSelectedVeterinarioId(null);
      setSelectedDate(null);
      setSlotSelected(null);
      setMotivo('');
      await refreshCitas();
    } catch (err:any) {
      console.error('Error creando cita', err);
      if (err?.response?.status === 409) {
        Alert.alert('Conflicto', err.response.data?.message || 'Cita solapada. Intenta otra franja.');
      } else {
        Alert.alert('Error', err?.response?.data?.message || err.message || 'Error creando cita');
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={{ marginTop: 10 }}>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Agendar cita</Text>
        <Text style={styles.subtitle}>Ver y agendar citas tus propias citas</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNumber}>{mascotas.length}</Text><Text style={styles.statLabel}>Mascotas</Text></View>
        <View style={styles.statCard}><Text style={styles.statNumber}>{citas.length}</Text><Text style={styles.statLabel}>Citas</Text></View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.primaryButtonText}>+ Agendar nueva cita</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de citas */}
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <Text style={{ marginBottom: 8, fontWeight: '700' }}>Mis citas</Text>
        <FlatList
          data={citas}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={() => <Text style={{ color: '#6b7280' }}>No tienes citas</Text>}
          renderItem={({ item }) => {
            const fecha = item.fecha_inicio ? formatDateTimeNice(item.fecha_inicio) : '-';
            return (
              <View style={styles.citaCard}>
                <View>
                  <Text style={{ fontWeight: '700' }}>{item.mascota_nombre || '—'}</Text>
                  <Text style={{ color: '#6b7280' }}>{fecha}</Text>
                  <Text style={{ color: '#6b7280' }}>{item.veterinario_nombre || '-'} • {item.duracion_min} min</Text>
                  <Text style={{ marginTop: 6 }}>Estado: {item.estado}</Text>
                </View>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() => setDetailCita(item)}
                >
                  <Text style={{ color: '#fff' }}>Ver</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>

      {/* Crear cita modal */}
      <Modal visible={showCreateModal} animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.modalTitle}>Crear cita</Text>

          <Text style={styles.label}>Mascota</Text>
          <View style={styles.selectorContainer}>
            {mascotas.length === 0 ? (
              <Text style={{ color: '#6b7280' }}>No tienes mascotas registradas</Text>
            ) : (
              mascotas.map(m => (
                <TouchableOpacity key={m.id} style={[styles.option, selectedMascotaId === m.id && styles.optionSelected]} onPress={() => setSelectedMascotaId(m.id)}>
                  <Text style={{ fontWeight: 600 }}>{m.nombre}</Text>
                  <Text style={{ color: '#6b7280' }}>{m.especie || m.raza || ''}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <Text style={styles.label}>Veterinario (opcional)</Text>
          <View style={styles.selectorContainer}>
            <TouchableOpacity style={[styles.option, selectedVeterinarioId === null && styles.optionSelected]} onPress={() => setSelectedVeterinarioId(null)}>
              <Text>-- Cualquiera --</Text>
            </TouchableOpacity>
            {veterinarios.map(v => (
              <TouchableOpacity key={v.id} style={[styles.option, selectedVeterinarioId === v.id && styles.optionSelected]} onPress={() => setSelectedVeterinarioId(v.id)}>
                <Text style={{ fontWeight: 600 }}>{v.nombre}</Text>
                <Text style={{ color: '#6b7280' }}>{v.email}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Tipo de consulta</Text>
          <View style={styles.selectorContainer}>
            {['consulta general','vacunacion','urgencia','cirugia','peluqueria','control','desparacitacion'].map(t => (
              <TouchableOpacity key={t} style={[styles.option, tipoConsulta === t && styles.optionSelected]} onPress={() => setTipoConsulta(t)}>
                <Text style={{ fontWeight: tipoConsulta === t ? '700' : '400' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Fecha</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text>{selectedDate ? formatDateToYYYYMMDD(selectedDate) : 'Seleccionar fecha'}</Text>
          </TouchableOpacity>

          {/* DateTimePicker */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate || new Date(+new Date() + 24*60*60*1000)} // default mañana
              mode="date"
              display="default"
              minimumDate={ new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()+1) } // desde mañana
              onChange={onDateChange}
            />
          )}

          <TouchableOpacity style={styles.ghostButton} onPress={fetchSlots}>
            {slotsLoading ? <ActivityIndicator color="#059669" /> : <Text>Buscar horarios disponibles</Text>}
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 8 }]}>Horarios disponibles</Text>
          {slotsLoading ? <ActivityIndicator /> : (
            Object.keys(slotsByVet).length === 0 ? (
              <Text style={{ color: '#6b7280' }}>No hay horarios cargados. Presiona "Buscar horarios disponibles".</Text>
            ) : (
              Object.entries(slotsByVet).map(([vid, list]) => {
                const vet = veterinarios.find(v => String(v.id) === String(vid));
                return (
                  <View key={vid} style={{ marginBottom: 10 }}>
                    <Text style={{ fontWeight: 700 }}>{vet ? `${vet.nombre} (${vet.email})` : `Veterinario ${vid}`}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {list.map(s => (
                        <TouchableOpacity
                          key={s.startIsoLocal}
                          style={[styles.slot, slotSelected === s.startIsoLocal && styles.slotSelected]}
                          onPress={() => { setSlotSelected(s.startIsoLocal); setSelectedVeterinarioId(Number(vid)); }}
                        >
                          <Text style={slotSelected === s.startIsoLocal ? { color: '#fff' } : undefined}>{s.timeStr}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })
            )
          )}

          <Text style={styles.label}>Motivo (opcional)</Text>
          <TextInput value={motivo} onChangeText={setMotivo} placeholder="Ej: revisión anual" style={styles.input} />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={validateAndCreate} disabled={creating}>
              <Text style={styles.primaryButtonText}>{creating ? 'Guardando...' : 'Crear cita'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ghostButton, { flex: 1 }]} onPress={() => setShowCreateModal(false)} disabled={creating}>
              <Text>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Modal>

      {/* Detail cita modal */}
      <Modal visible={!!detailCita} animationType="slide" onRequestClose={() => setDetailCita(null)}>
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.modalTitle}>Detalle de la cita</Text>
          {detailCita ? (
            <View>
              <Text style={{ fontWeight: 700, fontSize: 16 }}>{detailCita.mascota_nombre || '—'}</Text>
              <Text style={{ color: '#6b7280', marginTop: 6 }}>{formatDateTimeNice(detailCita.fecha_inicio)}</Text>
              <Text style={{ color: '#6b7280' }}>{detailCita.veterinario_nombre || '-' } • {detailCita.duracion_min} min</Text>

              <View style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: 700 }}>Tipo de consulta</Text>
                <Text style={{ color: '#374151' }}>{detailCita.tipo_consulta || '-'}</Text>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: 700 }}>Motivo</Text>
                <Text style={{ color: '#374151' }}>{detailCita.motivo || '-'}</Text>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: 700 }}>Estado</Text>
                <Text style={{ color: '#374151' }}>{detailCita.estado || '-'}</Text>
              </View>

              <View style={{ marginTop: 20, flexDirection:'row', gap:8 }}>
                <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={() => setDetailCita(null)}>
                  <Text style={styles.primaryButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 18, paddingTop: 28, backgroundColor: '#059669', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#D1FAE5', marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingHorizontal: 16 },
  statCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, width: '45%', alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  primaryButton: { backgroundColor: '#059669', padding: 14, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  ghostButton: { backgroundColor: '#fff', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8 },
  citaCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallBtn: { backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  modalContainer: { padding: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { marginTop: 8, marginBottom: 6, fontWeight: '600' },
  selectorContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  option: { backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#f3f4f6', marginRight: 8, marginBottom: 8 },
  optionSelected: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center' },
  slot: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8, marginRight: 8 },
  slotSelected: { backgroundColor: '#059669', borderColor: '#059669' }
});