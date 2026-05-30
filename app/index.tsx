import { router } from 'expo-router';
import React, { useState } from 'react';
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
import { loginPropietario } from '../services/api';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa tu correo y contraseña.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    setLoading(true);
    try {
      const result = await loginPropietario({ email: email.trim(), password });
      if (result.success && result.propietario) {
        router.replace('/home');
      } else {
        Alert.alert('Acceso denegado', result.message || 'Credenciales incorrectas.');
      }
    } catch (error: any) {
      if (error.status === 401) {
        Alert.alert('Acceso denegado', 'Email o contraseña incorrectos.');
      } else {
        Alert.alert('Error de conexión', 'No se pudo conectar al servidor. Verifica tu internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={S.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Brand ── */}
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🐾</Text>
          </View>
          <Text style={styles.brandName}>VetCare</Text>
          <Text style={styles.brandSub}>Sistema veterinario</Text>
        </View>

        {/* ── Formulario ── */}
        <View style={[S.card, styles.form]}>
          <Text style={styles.formTitle}>Bienvenido de nuevo</Text>
          <Text style={[S.small, { marginBottom: 24, textAlign: 'center' }]}>
            Ingresa con tu cuenta de propietario
          </Text>

          <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
          <TextInput
            style={S.input}
            placeholder="ejemplo@gmail.com"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
          <View style={styles.passWrapper}>
            <TextInput
              style={[S.input, { flex: 1, marginBottom: 0 }]}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPass(v => !v)}
            >
              <Text style={{ color: C.subtext, fontSize: 18 }}>
                {showPass ? '🙈' : '👁'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[S.btnPrimary, { marginTop: 20, marginBottom: 14 }, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.accentText} />
              : <Text style={S.btnPrimaryText}>Acceder</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={{ alignItems: 'center' }}
            onPress={() => Alert.alert('Recuperar contraseña', 'Contacta a la veterinaria para restablecer tu contraseña.')}
          >
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Info ── */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📋 Importante</Text>
          <Text style={styles.infoLine}>• Usa el email y contraseña que te proporcionó la veterinaria.</Text>
          <Text style={styles.infoLine}>• Para crear una cuenta, visita la clínica o llama al +506 7777-9999.</Text>
          <Text style={styles.infoLine}>• Emergencias (feriados / domingos): +506 8888-8888.</Text>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={[S.small, { textAlign: 'center' }]}>¿Primera vez en el sistema?</Text>
          <TouchableOpacity
            onPress={() => Alert.alert('Registro', 'Para registrarte como propietario, contacta a la veterinaria directamente.')}
          >
            <Text style={[styles.registerLink]}>Solicitar registro</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: C.bg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.accentBg,
    borderWidth: 2,
    borderColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 36,
  },
  brandName: {
    fontSize: 34,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -1,
  },
  brandSub: {
    fontSize: 14,
    color: C.subtext,
    marginTop: 4,
  },
  form: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.subtext,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2,
  },
  passWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  eyeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  infoBox: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: C.info,
    marginBottom: 28,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginBottom: 10,
  },
  infoLine: {
    fontSize: 13,
    color: C.subtext,
    lineHeight: 20,
    marginBottom: 4,
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  registerLink: {
    color: C.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});