import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { C, S, STATUS_MAP, TIPO_MAP } from '../constants/theme';
import {
  getCitasByPropietario,
  getCurrentPropietario,
  getMascotasByPropietario,
  logoutPropietario,
} from '../services/api';

// Intervalo de refresco automático del dashboard (ms)
const AUTO_REFRESH_MS = 60000;

// ─── Componentes locales ───────────────────────────────────────────────────────

function StatusBadge({ estado }: { estado: string }) {
  const cfg = STATUS_MAP[(estado || '').toLowerCase()] ?? STATUS_MAP.pendiente;
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

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopWidth: 2, borderTopColor: color }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ fontSize: 26, fontWeight: '800', color, marginTop: 6 }}>{value}</Text>
      <Text style={[S.small, { marginTop: 2, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, subtitle, onPress }: {
  icon: string; label: string; subtitle: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.actionIcon}>
        <Text style={{ fontSize: 26 }}>{icon}</Text>
      </View>
      <Text style={[S.h3, { marginTop: 10, fontSize: 15 }]}>{label}</Text>
      <Text style={[S.small, { marginTop: 3, fontSize: 12, textAlign: 'center' }]}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [user, setUser]         = useState<any>(null);
  const [mascotas, setMascotas] = useState<any[]>([]);
  const [citas, setCitas]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);

  // silent=true refresca los datos sin mostrar el spinner de pantalla completa
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const userData = await getCurrentPropietario();
      setUser(userData);
      if (userData?.id) {
        const [m, c] = await Promise.all([
          getMascotasByPropietario(userData.id).catch(() => []),
          getCitasByPropietario(userData.id).catch(() => []),
        ]);
        setMascotas(m || []);
        setCitas(c || []);
      }
      hasLoaded.current = true;
    } catch {
      if (!silent) Alert.alert('Error', 'No se pudieron cargar tus datos.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Se ejecuta cada vez que la pantalla gana foco (al entrar o al volver de otra
  // pantalla) y programa un refresco silencioso periódico mientras esté visible.
  useFocusEffect(
    useCallback(() => {
      loadData(hasLoaded.current);
      const interval = setInterval(() => loadData(true), AUTO_REFRESH_MS);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sí, salir', style: 'destructive', onPress: async () => {
        await logoutPropietario();
        router.replace('/');
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[S.small, { marginTop: 12 }]}>Cargando tu información...</Text>
      </View>
    );
  }

  const pendingCount   = citas.filter(c => (c.estado || '').toLowerCase() === 'pendiente').length;
  const confirmedCount = citas.filter(c => (c.estado || '').toLowerCase() === 'confirmada').length;
  const recentCitas    = [...citas]
    .sort((a, b) => new Date(b.fecha_inicio || 0).getTime() - new Date(a.fecha_inicio || 0).getTime())
    .slice(0, 3);

  const firstName = (user?.nombre || 'Usuario').split(' ')[0];

  return (
    <ScrollView
      style={S.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
      }
    >

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[S.small, { marginBottom: 4 }]}>Bienvenido de nuevo 👋</Text>
          <Text style={[S.h1, { color: C.accent }]}>{firstName}</Text>
          <Text style={[S.small, { marginTop: 2 }]}>{user?.email || ''}</Text>
        </View>
        <TouchableOpacity style={styles.avatarCircle}>
          <Text style={{ fontSize: 28 }}>🐾</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <StatCard icon="🐾" label="Mascotas"   value={mascotas.length}  color={C.accent}   />
          <StatCard icon="⏳" label="Pendientes"  value={pendingCount}     color={C.warning}  />
          <StatCard icon="✅" label="Confirmadas" value={confirmedCount}   color={C.info}     />
        </View>

        {/* ── Acciones rápidas ── */}
        <Text style={[S.label, { marginBottom: 14 }]}>Acciones rápidas</Text>
        <View style={styles.actionsGrid}>
          <QuickAction
            icon="🐕" label="Mis mascotas"
            subtitle={`${mascotas.length} registrada${mascotas.length !== 1 ? 's' : ''}`}
            onPress={() => router.push('/mascotas')}
          />
          <QuickAction
            icon="📅" label="Agendar cita"
            subtitle="Reserva tu próxima visita"
            onPress={() => router.push('/agendar-cita')}
          />
          <QuickAction
            icon="🏥" label="Historial médico"
            subtitle="Fichas y registros"
            onPress={() => router.push('/historial-medico')}
          />
          <QuickAction
            icon="👤" label="Mi perfil"
            subtitle="Ver y editar datos"
            onPress={() => router.push('/profile')}
          />
        </View>

        {/* ── Citas recientes ── */}
        <Text style={[S.label, { marginBottom: 14, marginTop: 8 }]}>Citas recientes</Text>

        {recentCitas.length === 0 ? (
          <View style={[S.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
            <Text style={S.small}>No tienes citas registradas aún.</Text>
            <TouchableOpacity
              style={[S.btnPrimary, { marginTop: 14, paddingHorizontal: 24 }]}
              onPress={() => router.push('/agendar-cita')}
            >
              <Text style={S.btnPrimaryText}>Agendar ahora</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentCitas.map(c => {
            const tipoCfg = TIPO_MAP[(c.tipo_consulta || '').toLowerCase()];
            const fecha = c.fecha_inicio
              ? new Date(c.fecha_inicio).toLocaleDateString('es-CR', { weekday: 'short', month: 'short', day: 'numeric' })
              : '—';
            const hora = c.fecha_inicio
              ? new Date(c.fecha_inicio).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <View key={c.id} style={[S.card, styles.citaCard]}>
                <View style={styles.citaIcon}>
                  <Text style={{ fontSize: 22 }}>{tipoCfg?.icon ?? '📅'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[S.h3, { fontSize: 15 }]}>{c.mascota_nombre || '—'}</Text>
                    <StatusBadge estado={c.estado || 'pendiente'} />
                  </View>
                  <Text style={[S.small, { marginTop: 4 }]}>
                    {tipoCfg?.label ?? c.tipo_consulta ?? '—'} • {c.duracion_min} min
                  </Text>
                  <Text style={[S.small, { marginTop: 2 }]}>
                    📆 {fecha}  🕐 {hora}
                  </Text>
                  {c.veterinario_nombre ? (
                    <Text style={[S.small, { marginTop: 2 }]}>👨‍⚕️ {c.veterinario_nombre}</Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {citas.length > 3 && (
          <TouchableOpacity
            style={[S.btnGhost, { marginTop: 4 }]}
            onPress={() => router.push('/agendar-cita')}
          >
            <Text style={S.btnGhostText}>Ver todas las citas ({citas.length})</Text>
          </TouchableOpacity>
        )}

        {/* ── Logout ── */}
        <TouchableOpacity style={[S.btnDanger, { marginTop: 32 }]} onPress={handleLogout}>
          <Text style={S.btnDangerText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={[S.small, { textAlign: 'center', marginTop: 20, marginBottom: 10 }]}>
          Sistema Veterinario v2.0
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bgCard,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentBg,
    borderWidth: 2,
    borderColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.bgCard,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    width: '47%',
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  citaCard: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  citaIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
});
