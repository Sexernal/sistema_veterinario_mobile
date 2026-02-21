# Sistema Veterinario Móvil
Aplicación móvil para gestión veterinaria desarrollada con React Native (Expo) y TypeScript. Esta app permite a los usuarios (dueños de mascotas) editar su perfil, gestionar citas, historiales médicos y más, conectándose a una API backend desarrollada en Express.

## Tecnologías
-**React Native** (v0.81.5) con **Expo** (v54)
-**TypeScript** (v5.9.2)
-**React Navigation** (stack, bottom tabs, elementos)
-**Axios** para consumo de API REST
-**AsyncStorage** para almacenamiento local
-**Expo Vector Icons** para iconografía
-**@react-native-community/datetimepicker** para selección de fechas
-**React Native Reanimated** y **Gesture Handler** para animaciones fluidas
-**ESLint** configurado con Expo para mantener calidad de código

## Características

- **Autenticación**: Login de usuarios con manejo de sesiones mediante tokens JWT almacenados en AsyncStorage.
- **Conexión a API**: Comunicación con backend Express a través de Axios.
- **Navegación fluida**: Navegación por tabs y stack con transiciones animadas.
- **Interfaz moderna**: Diseño limpio y responsive, adaptable a distintos tamaños de pantalla.
- **Manejo de estados**: Uso de hooks de React y contexto para la gestión de datos globales.
- **Picker de fecha/hora**: Integración con datetimepicker para seleccionar fechas de citas.

## Requisitos previos

- Node.js (versión 18 o superior)
- npm o yarn
- Expo CLI (`npm install -g expo-cli`)
- Dispositivo físico (iOS/Android) con la app Expo Go, o un emulador configurado

## Instalación y configuración

1. **Clona el repositorio**
   ```bash
   git clone https://github.com/Sexernal/sistema_veterinario_mobile.git
   cd 
   
2. **Instala las dependencias**
npm install
# o
yarn install

3. **Configuracion de variable de entorno**
Yo la manejo desde el api.ts y ya deberia estar conectada a el vercel

4. **Inicia la aplicacion**
npx expo start