import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// 📌 CAMBIA ESTO: Tu IP local y puerto
const API_URL = 'http://192.168.1.9:3001/api/v1';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
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

// Interceptor para añadir token
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error obteniendo token:', error);
  }
  return config;
});

// Función de login
export const loginUser = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    console.log('Conectando a:', `${API_URL}/auth/login`);
    const response = await api.post('/auth/login', credentials);
    
    if (response.data.token) {
      // Guardar token y datos del usuario
      await AsyncStorage.setItem('userToken', response.data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
    }
    
    return response.data;
  } catch (error: any) {
    console.error('Error en login:', error);
    throw error.response?.data || { 
      success: false, 
      message: 'No se pudo conectar al servidor' 
    };
  }
};

// Función para obtener usuario actual
export const getCurrentUser = async (): Promise<any> => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
};

// Función para cerrar sesión
export const logoutUser = async (): Promise<void> => {
  await AsyncStorage.removeItem('userToken');
  await AsyncStorage.removeItem('userData');
};

// Función para verificar autenticación
export const isAuthenticated = async (): Promise<boolean> => {
  const token = await AsyncStorage.getItem('userToken');
  return !!token;
};

export default api;