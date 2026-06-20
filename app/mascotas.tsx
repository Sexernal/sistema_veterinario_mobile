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
import { getCurrentPropietario, getMascotasByPropietario } from '../services/api';

type Mascota = {
  id: number;
  nombre?: string;
  especie?: string;
  raza?: string;
  edad?: number | null;
  fecha_nacimiento?: string | null;
  historial_medico?: string | null;
  created_at?: string | null;
  [k: string]: any;
};

const getSpeciesIcon = (especie?: string) =>
  SPECIES_ICONS[(especie || '').toLowerCase()] ?? '🐾';

function calcEdad(fechaNacimiento?: string | null): string | null {
  if (!fechaNacimiento) return null;
  const ymd = fechaNacimiento.slice(0, 10);
  const nac = new Date(ymd + 'T00:00:00');
  if (isNaN(nac.getTime())) return null;
  const hoy = new Date();
  if (nac > hoy) return null;
  let years  = hoy.getFullYear() - nac.getFullYear();
  let months = hoy.getMonth()    - nac.getMonth();
  if (hoy.getDate() < nac.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years <= 0 && months <= 0) {
    const dias = Math.max(0, Math.floor((hoy.getTime() - nac.getTime()) / 86400000));
    if (dias === 0) return 'Recién nacido';
    return `${dias} día${dias !== 1 ? 's' : ''}`;
  }
  if (years === 0)  return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  if (months === 0) return `${years} año${years !== 1 ? 's' : ''}`;
  return `${years} año${years !== 1 ? 's' : ''} y ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

function formatFechaNacimiento(fecha?: string | null): string {
  if (!fecha) return '—';
  const ymd = fecha.slice(0, 10);
  const d = new Date(ymd + 'T00:00:00');
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={S.label}>{label}</Text>
      <Text style={[S.body, { marginTop: 3 }]}>{value}</Text>
    </View>
  );
}

function PetCard({ mascota, onPress }: { mascota: Mascota; onPress: () => void }) {
  const especieRaza = [mascota.especie, mascota.raza].filter(Boolean).join(' · ');
  const edadStr = calcEdad(mascota.fecha_nacimiento)
    ?? (mascota.edad != null ? `${mascota.edad} año${mascota.edad !== 1 ? 's' : ''}` : null);

  return (
    <TouchableOpacity style={styles.petCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconCircle}>
        <Text style={{ fontSize: 28 }}>{getSpeciesIcon(mascota.especie)}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={S.h3}>{mascota.nombre || '—'}</Text>
        {especieRaza ? <Text style={S.small}>{especieRaza}</Text> : null}
        {edadStr ? <Text style={S.small}>⏱ {edadStr}</Text> : null}
      </View>
      <Text style={{ color: C.muted, fontSize: 22 }}>›</Text>
    </TouchableOpacity>
  );
}

function PetDetailModal({
  mascota,
  onClose,
}: {
  mascota: Mascota | null;
  onClose: () => void;
}) {
  if (!mascota) return null;
  const especieRaza = [mascota.especie, mascota.raza].filter(Boolean).join(' · ');
  const edadStr = calcEdad(mascota.fecha_nacimiento)
    ?? (mascota.edad != null ? `${mascota.edad} año${mascota.edad !== 1 ? 's' : ''}` : '—');
  const fechaNacStr = formatFechaNacimiento(mascota.fecha_nacimiento);
  const createdAt = mascota.created_at
    ? new Date(mascota.created_at).toLocaleDateString('es-CR', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={styles.iconCircle}>
                <Text style={{ fontSize: 32 }}>{getSpeciesIcon(mascota.especie)}</Text>
              </View>
              <View>
                <Text style={S.h2}>{mascota.nombre || '—'}</Text>
                <Text style={S.small}>{especieRaza || '—'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={{ color: C.subtext, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {mascota.fecha_nacimiento ? (
              <>
                <InfoRow label="FECHA DE NACIMIENTO" value={fechaNacStr} />
                <InfoRow label="EDAD" value={edadStr} />
              </>
            ) : (
              <InfoRow label="EDAD" value={edadStr} />
            )}
            {mascota.especie && <InfoRow label="ESPECIE" value={mascota.especie} />}
            {mascota.raza    && <InfoRow label="RAZA"    value={mascota.raza}    />}
            {createdAt       && <InfoRow label="REGISTRADA EL" value={createdAt}  />}

            {mascota.historial_medico ? (
              <View style={{ marginTop: 4 }}>
                <Text style={[S.label, { marginBottom: 8 }]}>OBSERVACIONES</Text>
                <View style={S.cardElevated}>
                  <Text style={S.body}>{mascota.historial_medico}</Text>
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

export default function MascotasScreen() {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mascotas, setMascotas]     = useState<Mascota[]>([]);
  const [selected, setSelected]     = useState<Mascota | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await getCurrentPropietario();
      if (!p?.id) {
        Alert.alert('Sesión expirada', 'Vuelve a iniciar sesión.');
        router.replace('/');
        return;
      }
      setMascotas((await getMascotasByPropietario(p.id)) || []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar las mascotas. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData().finally(() => setRefreshing(false));
  };

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[S.small, { marginTop: 12 }]}>Cargando mascotas...</Text>
      </View>
    );
  }

  return (
    <View style={S.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.accent, fontSize: 16, fontWeight: '600' }}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={S.h2}>Mis mascotas</Text>
        <Text style={S.small}>
          {mascotas.length} registrada{mascotas.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {mascotas.length === 0 ? (
          <View style={[S.card, { alignItems: 'center', paddingVertical: 48 }]}>
            <Text style={{ fontSize: 44, marginBottom: 14 }}>🐾</Text>
            <Text style={S.h3}>Sin mascotas registradas</Text>
            <Text style={[S.small, { marginTop: 8, textAlign: 'center', lineHeight: 20 }]}>
              Visita la clínica o llama a recepción para registrar a tu mascota.
            </Text>
          </View>
        ) : (
          mascotas.map(m => (
            <PetCard key={m.id} mascota={m} onPress={() => setSelected(m)} />
          ))
        )}
      </ScrollView>

      <PetDetailModal mascota={selected} onClose={() => setSelected(null)} />
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
  petCard: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accentBg,
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
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
});