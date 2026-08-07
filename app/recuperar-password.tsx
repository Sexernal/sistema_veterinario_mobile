// app/recuperar-password.tsx
// Restablecer la contraseña desde la app, en dos pasos:
//   1. cédula  → llega un código de 6 dígitos al correo registrado
//   2. código + contraseña nueva
//
// No se "recupera" la anterior: las contraseñas van con bcrypt y no se
// pueden leer. Lo que se hace es autorizar el cambio por correo.
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
import { confirmarResetPassword, solicitarResetPassword } from '../services/api';

const PASSWORD_MIN = 8;

// Mismas reglas que valida el API. Aquí solo es para avisar de una vez;
// el servidor las vuelve a comprobar.
function validarPassword(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return 'La contraseña debe combinar letras y números';
  return null;
}

export default function RecuperarPasswordScreen() {
  const [paso, setPaso]         = useState<1 | 2>(1);
  const [cedula, setCedula]     = useState('');
  const [emailPista, setEmailPista] = useState('');
  const [minutos, setMinutos]   = useState(30);

  const [codigo, setCodigo]     = useState('');
  const [password, setPassword] = useState('');
  const [repetir, setRepetir]   = useState('');
  const [verPass, setVerPass]   = useState(false);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // ── Paso 1 ────────────────────────────────────────────────────────
  const pedirCodigo = async () => {
    const ced = cedula.trim();
    if (!/^\d{9}$/.test(ced)) {
      setError('La cédula debe tener exactamente 9 dígitos.');
      return;
    }
    setError(''); setLoading(true);
    try {
      const data = await solicitarResetPassword(ced);
      setEmailPista(data?.email_enmascarado || '');
      setMinutos(data?.minutos || 30);
      setPaso(2);
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar el código.');
    } finally {
      setLoading(false);
    }
  };

  // ── Paso 2 ────────────────────────────────────────────────────────
  const cambiarPassword = async () => {
    if (!/^\d{6}$/.test(codigo.trim())) {
      setError('El código debe tener 6 dígitos.');
      return;
    }
    const invalida = validarPassword(password);
    if (invalida)             { setError(invalida); return; }
    if (password !== repetir) { setError('Las contraseñas no coinciden.'); return; }

    setError(''); setLoading(true);
    try {
      await confirmarResetPassword(cedula.trim(), codigo.trim(), password);
      Alert.alert(
        'Contraseña cambiada',
        'Ya puedes iniciar sesión con tu contraseña nueva.',
        [{ text: 'Iniciar sesión', onPress: () => router.replace('/') }]
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const reenviar = async () => {
    setCodigo(''); setError(''); setLoading(true);
    try {
      const data = await solicitarResetPassword(cedula.trim());
      setEmailPista(data?.email_enmascarado || '');
      Alert.alert('Código reenviado', 'Revisa tu correo de nuevo.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo reenviar el código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={S.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.contenedor} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => (paso === 2 ? setPaso(1) : router.back())}>
          <Text style={{ color: C.accent, fontSize: 16, fontWeight: '600' }}>‹ Volver</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>🔑</Text>
          <Text style={S.h2}>Restablecer contraseña</Text>
          <Text style={[S.small, { marginTop: 6, lineHeight: 20 }]}>
            {paso === 1
              ? 'Escribe tu cédula y te enviaremos un código al correo que tienes registrado en la veterinaria.'
              : 'Escribe el código que te llegó por correo y elige tu contraseña nueva.'}
          </Text>
        </View>

        {/* ── Paso 1: cédula ── */}
        {paso === 1 && (
          <View style={S.card}>
            <Text style={S.label}>CÉDULA</Text>
            <TextInput
              style={[S.input, { marginTop: 6 }]}
              value={cedula}
              onChangeText={(t) => setCedula(t.replace(/\D/g, '').slice(0, 9))}
              placeholder="123456789"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              maxLength={9}
              autoFocus
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[S.btnPrimary, { marginTop: 18 }]}
              onPress={pedirCodigo}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.accentText} />
                : <Text style={S.btnPrimaryText}>Enviar código</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Paso 2: código + contraseña ── */}
        {paso === 2 && (
          <View style={S.card}>
            {emailPista ? (
              <View style={styles.pista}>
                <Text style={{ color: C.success, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
                  ✅ Enviamos el código a
                </Text>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{emailPista}</Text>
                <Text style={[S.small, { marginTop: 6 }]}>
                  Vence en {minutos} minutos. Revisa también la carpeta de spam.
                </Text>
              </View>
            ) : null}

            <Text style={[S.label, { marginTop: 4 }]}>CÓDIGO DE 6 DÍGITOS</Text>
            <TextInput
              style={[S.input, styles.inputCodigo]}
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <Text style={[S.label, { marginTop: 16 }]}>CONTRASEÑA NUEVA</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[S.input, { marginTop: 6, paddingRight: 48 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.muted}
                secureTextEntry={!verPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.ojo}
                onPress={() => setVerPass((v) => !v)}
              >
                <Text style={{ fontSize: 17 }}>{verPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[S.label, { marginTop: 16 }]}>REPETIR CONTRASEÑA</Text>
            <TextInput
              style={[S.input, { marginTop: 6 }]}
              value={repetir}
              onChangeText={setRepetir}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
              secureTextEntry={!verPass}
              autoCapitalize="none"
            />

            <Text style={[S.small, { marginTop: 10 }]}>
              Mínimo {PASSWORD_MIN} caracteres, combinando letras y números.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[S.btnPrimary, { marginTop: 18 }]}
              onPress={cambiarPassword}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.accentText} />
                : <Text style={S.btnPrimaryText}>Cambiar contraseña</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ alignItems: 'center', marginTop: 14 }}
              onPress={reenviar}
              disabled={loading}
            >
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>
                Reenviar código
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📋 Importante</Text>
          <Text style={styles.infoLine}>
            • El código llega al correo que la veterinaria tiene registrado a tu nombre.
          </Text>
          <Text style={styles.infoLine}>
            • Si no tienes correo registrado o ya no lo usas, llama a la clínica al +506 7777-9999.
          </Text>
          <Text style={styles.infoLine}>
            • Nadie de la veterinaria te va a pedir este código. No lo compartas.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  pista: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 18,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  inputCodigo: {
    marginTop: 6,
    fontSize: 26,
    letterSpacing: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  ojo: {
    position: 'absolute',
    right: 14,
    top: 20,
  },
  error: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    color: C.danger,
    fontSize: 13,
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
  },
  infoLine: {
    fontSize: 12,
    color: C.subtext,
    lineHeight: 20,
  },
});
