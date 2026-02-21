// app/profile.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import api, { getCurrentPropietario } from '../services/api';

type Propietario = {
  id: number;
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  [k: string]: any;
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [user, setUser] = useState<Propietario | null>(null);

  // form
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [password, setPassword] = useState(''); // nueva contraseña
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); // contraseña actual necesaria para cambiar

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const stored = await getCurrentPropietario();
        if (!stored?.id) {
          Alert.alert('Error', 'No se encontró sesión. Vuelve a iniciar sesión.');
          router.replace('/');
          return;
        }
        setUser(stored);
        // rellena form con lo que tengamos
        setNombre(stored.nombre || '');
        setEmail(stored.email || '');
        setTelefono(stored.telefono || '');
        setDireccion(stored.direccion || '');

        // intentar traer versión actual desde API (si token válido)
        try {
          const res = await api.get(`/propietarios/${stored.id}`);
          const data = res.data?.data || res.data || null;
          if (data) {
            setUser(data);
            setNombre(data.nombre || '');
            setEmail(data.email || '');
            setTelefono(data.telefono || '');
            setDireccion(data.direccion || '');
            // guardar en AsyncStorage la versión actualizada
            await AsyncStorage.setItem('propietarioData', JSON.stringify(data));
          }
        } catch (err) {
          // si falla, no bloqueamos: usamos datos en local
          console.warn('No se pudo refrescar propietario desde API (puede que el token no permita).', err);
        }
      } catch (err) {
        console.error('Error inicializando perfil', err);
        Alert.alert('Error', 'Ocurrió un error cargando tu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // conserva + y dígitos y algunos separadores útiles
  const cleanPhone = (v: string) => v.replace(/[^0-9+\-\s()]/g, '');

  // Validaciones:
  // - nombre: al menos 2 palabras (cada una >= 2 chars)
  // - email: formato básico con @ y dominio
  // - telefono: debe empezar con "+506" y tener 8 dígitos después (acepta separadores)
  // - direccion: min 5 chars
  // - cambio de contraseña: si se quiere cambiar, requiere currentPassword, nueva password (>=8) y confirmación igual
  const validateForm = () => {
    const errs: string[] = [];

    // nombre: al menos dos palabras
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.some(p => p.length < 2)) {
      errs.push('Ingresa nombre y apellido (mínimo 2 palabras, cada una con al menos 2 caracteres).');
    }

    // email básico
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.push('Email inválido. Debe tener formato ejemplo@gmail.com');
    }

    // telefono: exigir +506 y 8 dígitos
    const raw = (telefono || '').trim();
    if (!raw) {
      errs.push('Teléfono requerido.');
    } else {
      // quitar todo excepto dígitos para contar
      const digitsOnly = telefono.replace(/\D/g, '');
      // debe contener el prefijo 506 y luego 8 dígitos => total 11 dígitos (506 + 8)
      const startsPlus506 = raw.startsWith('+506');
      if (!startsPlus506) {
        errs.push('El teléfono debe comenzar con el prefijo internacional +506.');
      } else if (digitsOnly.length !== 11 || !digitsOnly.startsWith('506')) {
        errs.push('Número inválido. Después de +506 debe haber 8 dígitos, ejemplo: +506 8888-8888.');
      }
    }

    // dirección
    if (!direccion || direccion.trim().length < 5) {
      errs.push('Dirección requerida (mínimo 5 caracteres).');
    }

    // password logic
    if (password) {
      if (password.length < 8) errs.push('La nueva contraseña debe tener al menos 8 caracteres.');
      if (password !== confirmPassword) errs.push('La nueva contraseña y confirmación no coinciden.');
      if (!currentPassword) errs.push('Para cambiar la contraseña debes ingresar tu contraseña actual.');
    }

    if (errs.length) {
      Alert.alert('Errores', errs.join('\n'));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!user?.id) return Alert.alert('Error', 'Usuario no disponible.');
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload: any = {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: cleanPhone(telefono),
        direccion: direccion.trim()
      };

      if (password) {
        // enviamos la contraseña actual junto a la nueva para que el backend verifique
        // backend debe aceptar `current_password` y `password` en /propietarios/me
        payload.current_password = currentPassword;
        payload.password = password;
      }

      // Llamada: endpoint que actualiza el perfil propio
      const res = await api.put('/propietarios/me', payload);
      const updated = res.data?.data || res.data;

      // actualizar AsyncStorage y estado local
      if (updated) {
        await AsyncStorage.setItem('propietarioData', JSON.stringify(updated));
        setUser(updated);
        setNombre(updated.nombre || '');
        setEmail(updated.email || '');
        setTelefono(updated.telefono || '');
        setDireccion(updated.direccion || '');
        // limpiar campos de contraseña
        setPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
        Alert.alert('Éxito', 'Perfil actualizado correctamente.');
      } else {
        Alert.alert('Éxito', 'Perfil actualizado.');
      }
    } catch (err: any) {
      console.error('Error actualizando perfil', err);
      // si 403/401 avisar que es probable que backend no permita updates desde propietario
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        Alert.alert(
          'No autorizado',
          'El servidor no permitió la actualización. Asegúrate de que el token sea válido y de que el endpoint /propietarios/me acepte current_password si vas a cambiar contraseña.'
        );
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Error actualizando perfil';
        Alert.alert('Error', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const goBackToDashboard = () => {
    // usamos replace para evitar push a rutas inválidas en expo
    router.replace('/dashboard');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={{ marginTop: 10 }}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Mi perfil</Text>
          <Text style={styles.subtitle}>Visualiza y actualiza tu información</Text>
        </View>

        <View style={{ padding: 16 }}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre Apellido"
            autoCapitalize="words"
            returnKeyType="done"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="ejemplo@gmail.com"
            textContentType="emailAddress"
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={telefono}
            onChangeText={v => setTelefono(cleanPhone(v))}
            keyboardType="phone-pad"
            placeholder="+506 8888-8888"
            textContentType="telephoneNumber"
          />

          <Text style={styles.label}>Dirección</Text>
          <TextInput
            style={styles.input}
            value={direccion}
            onChangeText={setDireccion}
            placeholder="Calle, número, ciudad"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Cambiar contraseña (opcional)</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Contraseña actual (requerida para cambiar)"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Nueva contraseña (mín 8)"
          />
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Confirmar nueva contraseña"
          />

          <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar cambios</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#059669', paddingVertical: 28, paddingHorizontal: 18, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#D1FAE5', marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { marginTop: 10, marginBottom: 6, marginLeft: 6, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  saveButton: { backgroundColor: '#059669', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  backButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  backButtonText: { color: '#374151', fontWeight: '700' },
});