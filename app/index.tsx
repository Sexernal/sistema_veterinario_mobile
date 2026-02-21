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
import { loginPropietario } from '../services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu correo y contraseña');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Ingresa un correo electrónico válido');
      return;
    }

    setLoading(true);

    try {
      const result = await loginPropietario({ email, password });
      
      if (result.success && result.propietario) {
        console.log('Login exitoso, propietario:', result.propietario);
        Alert.alert('¡Éxito!', `Bienvenido ${result.propietario.nombre || 'Propietario'}`, [
          { text: 'Continuar', onPress: () => router.replace('/home') }
        ]);
      } else {
        Alert.alert('Error', result.message || 'Credenciales incorrectas');
      }
    } catch (error: any) {
      console.error('Error completo en login:', error);
      
      if (error.message?.includes('network') || error.message?.includes('conexión')) {
        Alert.alert(
          'Error de conexión',
          'No se pudo conectar al servidor. Verifica:\n\n• Tu conexión a internet\n• Que el servidor esté encendido'
        );
      } else if (error.status === 401) {
        Alert.alert('Acceso denegado', 'Email o contraseña incorrectos');
      } else {
        Alert.alert('Error', error.message || 'Ocurrió un error inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    Alert.alert('Información', 'Para registrarte como propietario, contacta a la veterinaria directamente.');
  };

  const handleForgotPassword = () => {
    Alert.alert('Recuperar contraseña', 'Contacta a la veterinaria para restablecer tu contraseña.');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>🐾 VetCare Clinic</Text>
          <Text style={styles.subtitle}>Acceso para propietarios de mascotas</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Inicio de sesión</Text>
          
          <Text style={styles.label}>Correo electrónico registrado</Text>
          <TextInput
            style={styles.input}
            placeholder="ejemplo@gmail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
          
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
          
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Acceder como Propietario</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={handleForgotPassword}>
            <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📋 Información importante</Text>
          <Text style={styles.infoText}>
            • Usa el mismo email y contraseña que te proporcionó la veterinaria al crear tu cuenta
          </Text>
          <Text style={styles.infoText}>
            • Si no tienes cuenta, debes ir personalmente o contactar con recepción al número +506 7777-9999
          </Text>
          <Text style={styles.infoText}>
            • Para emergencias (en caso de que sea día feriado o domingos), llama al: +506 8888-8888
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Eres nuevo en el sistema?</Text>
          <TouchableOpacity onPress={handleRegister}>
            <Text style={styles.registerText}>Solicitar registro</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 56,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    height: 56,
    backgroundColor: '#059669',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#34D399',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  linkText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 8,
  },
  registerText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '600',
  },
});