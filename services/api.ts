import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'http://192.168.1.9:3001/api/v1';

interface LoginCredentials {
  cedula: string;
  password: string;
}

interface PropietarioData {
  id: number;
  cedula?: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  propietario?: PropietarioData;
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('propietarioToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (error) {
    console.error('Error obteniendo token:', error);
  }
  return config;
});

// 🔐 Login con cédula
export const loginPropietario = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const response = await api.post('/propietarios/login', credentials);
    const responseData = response.data;

    let propietarioData: PropietarioData | null = null;
    let tokenData: string | null = null;

    if (responseData.data) {
      propietarioData = responseData.data.propietario || responseData.data.user || responseData.data;
      tokenData = responseData.data.token || responseData.token;
    } else {
      propietarioData = responseData.propietario || responseData.user;
      tokenData = responseData.token;
    }

    if (tokenData && propietarioData) {
      await AsyncStorage.setItem('propietarioToken', tokenData);
      await AsyncStorage.setItem('propietarioData', JSON.stringify(propietarioData));
    }

    return { success: true, token: tokenData ?? undefined, propietario: propietarioData ?? undefined };
  } catch (error: any) {
    console.error('Error en login:', error.response?.data || error.message);
    throw error.response?.data || { success: false, message: 'No se pudo conectar al servidor' };
  }
};

// 👤 Obtener propietario actual
export const getCurrentPropietario = async (): Promise<PropietarioData | null> => {
  try {
    const propietarioData = await AsyncStorage.getItem('propietarioData');
    if (!propietarioData) return null;
    return JSON.parse(propietarioData);
  } catch (error) {
    console.error('Error obteniendo propietario:', error);
    return null;
  }
};

// 🐕 Obtener mascotas del propietario
export const getMascotasByPropietario = async (propietarioId: number) => {
  try {
    const response = await api.get(`/mascotas?owner_id=${propietarioId}`);
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.data.data)) return response.data.data;
    if (Array.isArray(response.data.mascotas)) return response.data.mascotas;
    return [];
  } catch (error: any) {
    console.error('Error al obtener mascotas:', error.response?.data || error.message);
    throw error.response?.data || { message: 'Error al obtener mascotas' };
  }
};

// 📅 Obtener citas del propietario
export const getCitasByPropietario = async (propietarioId: number) => {
  try {
    const response = await api.get(`/citas?propietario_id=${propietarioId}`);
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.data.data)) return response.data.data;
    if (Array.isArray(response.data.citas)) return response.data.citas;
    return [];
  } catch (error: any) {
    console.error('Error al obtener citas:', error.response?.data || error.message);
    throw error.response?.data || { message: 'Error al obtener citas' };
  }
};

// 🚪 Cerrar sesión
export const logoutPropietario = async (): Promise<void> => {
  await AsyncStorage.removeItem('propietarioToken');
  await AsyncStorage.removeItem('propietarioData');
};

// ✅ Verificar si está autenticado
export const isAuthenticated = async (): Promise<boolean> => {
  const token = await AsyncStorage.getItem('propietarioToken');
  return !!token;
};

export default api;