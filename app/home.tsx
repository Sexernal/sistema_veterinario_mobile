// app/home.tsx
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getCitasByPropietario,
  getCurrentPropietario,
  getMascotasByPropietario,
  logoutPropietario
} from '../services/api';

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [mascotas, setMascotas] = useState<any[]>([]);
  const [citas, setCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Obtener usuario actual desde AsyncStorage (servicio)
      const userData = await getCurrentPropietario();
      setUser(userData);

      // Si tenemos usuario, pedir mascotas y citas filtradas por propietario
      if (userData?.id) {
        try {
          const mascotasData = await getMascotasByPropietario(userData.id);
          setMascotas(mascotasData || []);
        } catch (mascotaError) {
          console.error('Error al cargar mascotas:', mascotaError);
          setMascotas([]);
        }

        try {
          const citasData = await getCitasByPropietario(userData.id);
          setCitas(citasData || []);
        } catch (citaError) {
          console.error('Error al cargar citas:', citaError);
          setCitas([]);
        }
      } else {
        // si no hay usuario guardado, limpiar
        setMascotas([]);
        setCitas([]);
      }
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos del usuario');
      setMascotas([]);
      setCitas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, salir',
          onPress: async () => {
            await logoutPropietario();
            router.replace('/');
          },
        },
      ]
    );
  };

  // Navegación a diferentes secciones
  const navigateToProfile = () => {
    router.push('/profile');
  };

  const navigateToMascotas = () => {
    router.push('/mascotas');
  };

  const navigateToAgendarCita = () => {
    router.push('/agendar-cita');
  };

  const navigateToHistorialMedico = () => {
    router.push('/historial-medico');
  };

  // Conteo de recordatorios: citas en estado "pendiente"
  const pendingCount = citas.filter(c => ((c.estado || '')?.toString().toLowerCase() === 'pendiente')).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Cargando información...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>¡Hola de nuevo!</Text>
        <Text style={styles.userName}>{user?.nombre || 'Usuario'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{mascotas.length}</Text>
          <Text style={styles.statLabel}>Mascotas</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{citas.length}</Text>
          <Text style={styles.statLabel}>Citas</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={navigateToProfile}
        >
          <Text style={styles.actionButtonText}>👤 Ver perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={navigateToMascotas}
        >
          <Text style={styles.actionButtonText}>🐕 Mis mascotas ({mascotas.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={navigateToAgendarCita}
        >
          <Text style={styles.actionButtonText}>📅 Agendar cita</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={navigateToHistorialMedico}
        >
          <Text style={styles.actionButtonText}>🏥 Historial médico</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Sistema Veterinario v2.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#059669',
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  greeting: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  userEmail: {
    fontSize: 16,
    color: '#D1FAE5',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: -20,
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '28%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    marginHorizontal: 24,
    marginVertical: 20,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});