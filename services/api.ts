import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// 📌 Tu IP local y puerto
const API_URL = 'https://api-express-mysql-para-vercel.vercel.app/api/v1';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  propietario?: {
    id: number;
    nombre: string;
    email: string;
    telefono?: string;
    direccion?: string;
  };
}

// Configuración de Axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Interceptor para añadir token automáticamente
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('propietarioToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error obteniendo token:', error);
  }
  return config;
});

// 🔐 FUNCIÓN DE LOGIN PARA PROPIETARIOS
export const loginPropietario = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    console.log('Conectando a:', `${API_URL}/propietarios/login`);
    
    const response = await api.post('/propietarios/login', credentials);
    
    // 📌 AJUSTE IMPORTANTE: Manejar diferentes formatos de respuesta
    const responseData = response.data;
    
    // Formato 1: { success: true, token: "...", propietario: {...} }
    // Formato 2: { success: true, token: "...", user: {...} }
    // Formato 3: { data: { ... } } (con data anidada)
    
    let propietarioData = null;
    let tokenData = null;
    
    if (responseData.data) {
      // Si hay campo data
      propietarioData = responseData.data.propietario || responseData.data.user || responseData.data;
      tokenData = responseData.data.token || responseData.token;
    } else {
      // Si no hay campo data
      propietarioData = responseData.propietario || responseData.user;
      tokenData = responseData.token;
    }
    
    if (tokenData && propietarioData) {
      // Guardar token y datos del propietario
      await AsyncStorage.setItem('propietarioToken', tokenData);
      await AsyncStorage.setItem('propietarioData', JSON.stringify(propietarioData));
      
      console.log('Propietario guardado:', propietarioData);
    }
    
    return {
      success: true,
      token: tokenData,
      propietario: propietarioData
    };
    
  } catch (error: any) {
    console.error('Error en login:', error.response?.data || error.message);
    throw error.response?.data || { 
      success: false, 
      message: 'No se pudo conectar al servidor' 
    };
  }
};

// 👤 Obtener propietario actual
export const getCurrentPropietario = async (): Promise<any> => {
  try {
    const propietarioData = await AsyncStorage.getItem('propietarioData');
    if (!propietarioData) return null;
    
    const parsed = JSON.parse(propietarioData);
    console.log('Propietario recuperado:', parsed);
    return parsed;
  } catch (error) {
    console.error('Error obteniendo propietario:', error);
    return null;
  }
};

// 🐕 Obtener mascotas del propietario
export const getMascotasByPropietario = async (propietarioId: number) => {
  try {
    console.log('Obteniendo mascotas para propietario:', propietarioId);
    const response = await api.get(`/mascotas?owner_id=${propietarioId}`);
    
    // Manejar diferentes formatos de respuesta
    let mascotas = [];
    
    if (Array.isArray(response.data)) {
      mascotas = response.data;
    } else if (response.data.data && Array.isArray(response.data.data)) {
      mascotas = response.data.data;
    } else if (response.data.mascotas && Array.isArray(response.data.mascotas)) {
      mascotas = response.data.mascotas;
    }
    
    console.log('Mascotas obtenidas:', mascotas.length);
    return mascotas;
  } catch (error: any) {
    console.error('Error al obtener mascotas:', error.response?.data || error.message);
    throw error.response?.data || { message: 'Error al obtener mascotas' };
  }
};

// 📅 Obtener citas del propietario
export const getCitasByPropietario = async (propietarioId: number) => {
  try {
    console.log('Obteniendo citas para propietario:', propietarioId);
    const response = await api.get(`/citas?propietario_id=${propietarioId}`);
    
    // Manejar diferentes formatos de respuesta
    let citas = [];
    
    if (Array.isArray(response.data)) {
      citas = response.data;
    } else if (response.data.data && Array.isArray(response.data.data)) {
      citas = response.data.data;
    } else if (response.data.citas && Array.isArray(response.data.citas)) {
      citas = response.data.citas;
    }
    
    console.log('Citas obtenidas:', citas.length);
    return citas;
  } catch (error: any) {
    console.error('Error al obtener citas:', error.response?.data || error.message);
    throw error.response?.data || { message: 'Error al obtener citas' };
  }
};

// 🚪 Cerrar sesión
export const logoutPropietario = async (): Promise<void> => {
  await AsyncStorage.removeItem('propietarioToken');
  await AsyncStorage.removeItem('propietarioData');
  console.log('Sesión cerrada');
};

// ✅ Verificar si está autenticado
export const isAuthenticated = async (): Promise<boolean> => {
  const token = await AsyncStorage.getItem('propietarioToken');
  return !!token;
};

export default api;