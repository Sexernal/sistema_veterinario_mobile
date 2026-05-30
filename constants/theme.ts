import { StyleSheet } from 'react-native';

// ─── Paleta de colores ────────────────────────────────────────────────────────
export const C = {
  // Fondos
  bg:         '#0B0F1A',
  bgCard:     '#111827',
  bgElevated: '#1A2234',
  bgInput:    '#161D2F',

  // Bordes
  border:      'rgba(255,255,255,0.08)',
  borderStrong:'rgba(255,255,255,0.14)',

  // Acento principal (teal/mint premium)
  accent:    '#10D9A0',
  accentDim: '#0BA37A',
  accentBg:  'rgba(16,217,160,0.12)',
  accentText:'#0B0F1A', // texto sobre botón accent

  // Texto
  text:    '#F1F5F9',
  subtext: '#94A3B8',
  muted:   '#475569',

  // Semánticos
  danger:  '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info:    '#3B82F6',

  // Overlays
  overlay: 'rgba(0,0,0,0.65)',
  white10: 'rgba(255,255,255,0.10)',
  white05: 'rgba(255,255,255,0.05)',
  white03: 'rgba(255,255,255,0.03)',
};

// ─── Estados de cita ──────────────────────────────────────────────────────────
export const STATUS_MAP: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  pendiente:  { label: 'Pendiente',  icon: '⏳', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.30)'  },
  confirmada: { label: 'Confirmada', icon: '✅', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.30)'  },
  completada: { label: 'Completada', icon: '🏁', color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)'  },
  cancelada:  { label: 'Cancelada',  icon: '✖',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.30)'   },
};

// ─── Tipos de consulta ────────────────────────────────────────────────────────
export const TIPO_MAP: Record<string, { label: string; icon: string; durationMin: number }> = {
  'consulta general': { label: 'Consulta general', icon: '🩺', durationMin: 30  },
  'vacunacion':       { label: 'Vacunación',        icon: '💉', durationMin: 20  },
  'urgencia':         { label: 'Urgencia',          icon: '🚨', durationMin: 60  },
  'cirugia':          { label: 'Cirugía',           icon: '🔬', durationMin: 120 },
  'peluqueria':       { label: 'Peluquería',        icon: '✂️', durationMin: 45  },
  'control':          { label: 'Control',           icon: '📋', durationMin: 20  },
  'desparacitacion':  { label: 'Desparasitación',   icon: '🧴', durationMin: 15  },
};

// ─── Íconos por especie (sincronizado con web) ────────────────────────────────
export const SPECIES_ICONS: Record<string, string> = {
  perro: '🐕', gato: '🐈', ave: '🐦', pajaro: '🐦',
  conejo: '🐇', serpiente: '🐍', hamster: '🐹',
  tortuga: '🐢', pez: '🐟', caballo: '🐴',
};

// ─── Estilos compartidos ──────────────────────────────────────────────────────
export const S = StyleSheet.create({
  // Contenedores
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Tarjetas
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardElevated: {
    backgroundColor: C.bgElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },

  // Tipografía
  h1:    { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  h2:    { fontSize: 22, fontWeight: '700', color: C.text },
  h3:    { fontSize: 17, fontWeight: '600', color: C.text },
  body:  { fontSize: 15, color: C.text, lineHeight: 22 },
  small: { fontSize: 13, color: C.subtext },
  label: { fontSize: 11, fontWeight: '700', color: C.subtext, letterSpacing: 0.8, textTransform: 'uppercase' },

  // Inputs
  input: {
    backgroundColor: C.bgInput,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 15,
    marginBottom: 12,
  },

  // Botones
  btnPrimary: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  btnPrimaryText: {
    color: C.accentText,
    fontSize: 15,
    fontWeight: '700',
  },
  btnGhost: {
    backgroundColor: C.white05,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: C.border,
  },
  btnGhostText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
  btnDanger: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
  },
  btnDangerText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },

  // Modal overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: C.bgCard,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
});