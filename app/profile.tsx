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
  View,
} from 'react-native';
import { C, S } from '../constants/theme';
import api, { getCurrentPropietario } from '../services/api';

type Propietario = {
  id: number;
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  [k: string]: any;
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={S.small}>{subtitle}</Text>}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[S.label, { marginBottom: 6 }]}>{label}</Text>
      <TextInput
        style={[S.input, { marginBottom: 0 }, !editable && { opacity: 0.5 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        secureTextEntry={secureTextEntry}
        editable={editable}
      />
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [user, setUser]       = useState<Propietario | null>(null);

  const [nombre, setNombre]   = useState('');
  const [email, setEmail]     = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');

  const [showPassSection, setShowPassSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const stored = await getCurrentPropietario();
        if (!stored?.id) {
          Alert.alert('Sesión expirada', 'Vuelve a iniciar sesión.');
          router.replace('/');
          return;
        }
        fillForm(stored);

        // Refrescar desde API si el token lo permite
        try {
          const res = await api.get(`/propietarios/${stored.id}`);
          const data = res.data?.data || res.data;
          if (data) {
            fillForm(data);
            await AsyncStorage.setItem('propietarioData', JSON.stringify(data));
          }
        } catch {
          // Usamos datos locales si la API falla — no bloqueamos
        }
      } catch {
        Alert.alert('Error', 'No se pudo cargar tu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fillForm = (data: Propietario) => {
    setUser(data);
    setNombre(data.nombre || '');
    setEmail(data.email || '');
    setTelefono(data.telefono || '');
    setDireccion(data.direccion || '');
  };

  const cleanPhone = (v: string) => v.replace(/[^0-9+\-\s()]/g, '');

  const validate = (): string[] => {
    const errs: string[] = [];
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.some(p => p.length < 2))
      errs.push('Ingresa nombre y apellido (mínimo 2 palabras).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.push('Correo inválido.');
    if (!telefono.trim())
      errs.push('Teléfono requerido.');
    else if (!telefono.startsWith('+506') || telefono.replace(/\D/g, '').length !== 11)
      errs.push('Teléfono debe comenzar con +506 y tener 8 dígitos. Ej: +506 8888-8888.');
    if (!direccion.trim() || direccion.trim().length < 5)
      errs.push('Dirección requerida (mínimo 5 caracteres).');
    if (showPassSection && password) {
      if (password.length < 8)    errs.push('Nueva contraseña: mínimo 8 caracteres.');
      if (password !== confirmPassword) errs.push('Las contraseñas no coinciden.');
      if (!currentPassword)       errs.push('Ingresa tu contraseña actual para cambiarla.');
    }
    return errs;
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const errs = validate();
    if (errs.length) {
      Alert.alert('Revisa los datos', errs.join('\n'));
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: cleanPhone(telefono),
        direccion: direccion.trim(),
      };
      if (showPassSection && password) {
        payload.current_password = currentPassword;
        payload.password = password;
      }

      const res = await api.put('/propietarios/me', payload);
      const updated = res.data?.data || res.data;
      if (updated) {
        await AsyncStorage.setItem('propietarioData', JSON.stringify(updated));
        fillForm(updated);
      }
      // Limpiar campos de contraseña tras guardar
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      setShowPassSection(false);
      Alert.alert('¡Listo!', 'Tu perfil fue actualizado correctamente.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al guardar.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[S.small, { marginTop: 12 }]}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={S.screen}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.accent, fontSize: 16, fontWeight: '600' }}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={S.h2}>Mi perfil</Text>
        <Text style={S.small}>Visualiza y edita tu información</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={{ fontSize: 40 }}>👤</Text>
          <Text style={[S.h2, { marginTop: 10 }]}>{user?.nombre || '—'}</Text>
          <Text style={S.small}>{user?.email || ''}</Text>
        </View>

        {/* Información personal */}
        <SectionHeader title="Información personal" />
        <View style={S.card}>
          <Field
            label="NOMBRE COMPLETO"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre Apellido"
            autoCapitalize="words"
          />
          <Field
            label="CORREO ELECTRÓNICO"
            value={email}
            onChangeText={setEmail}
            placeholder="ejemplo@gmail.com"
            keyboardType="email-address"
          />
        </View>

        {/* Contacto */}
        <SectionHeader title="Contacto" />
        <View style={S.card}>
          <Field
            label="TELÉFONO"
            value={telefono}
            onChangeText={v => setTelefono(cleanPhone(v))}
            placeholder="+506 8888-8888"
            keyboardType="phone-pad"
          />
          <Field
            label="DIRECCIÓN"
            value={direccion}
            onChangeText={setDireccion}
            placeholder="Provincia, cantón, dirección exacta"
            autoCapitalize="sentences"
          />
        </View>

        {/* Seguridad */}
        <SectionHeader title="Seguridad" />
        <TouchableOpacity
          style={[S.card, styles.togglePass]}
          onPress={() => setShowPassSection(v => !v)}
          activeOpacity={0.8}
        >
          <Text style={S.body}>🔐 Cambiar contraseña</Text>
          <Text style={{ color: C.subtext, fontSize: 18 }}>
            {showPassSection ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showPassSection && (
          <View style={[S.card, { marginTop: 8 }]}>
            <Field
              label="CONTRASEÑA ACTUAL"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Tu contraseña actual"
              secureTextEntry
            />
            <Field
              label="NUEVA CONTRASEÑA"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              secureTextEntry
            />
            <Field
              label="CONFIRMAR NUEVA CONTRASEÑA"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite la nueva contraseña"
              secureTextEntry
            />
          </View>
        )}

        {/* Guardar */}
        <TouchableOpacity
          style={[S.btnPrimary, { marginTop: 24 }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={C.accentText} />
            : <Text style={S.btnPrimaryText}>Guardar cambios</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  avatar: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 8,
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionHeader: {
    marginBottom: 10,
    marginTop: 20,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  togglePass: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});