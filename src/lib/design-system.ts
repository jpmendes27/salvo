// src/lib/design-system.ts

export const colors = {
  bg: '#050505',
  card: 'rgba(255,255,255,0.025)',
  cardMetrics: 'rgba(255,255,255,0.035)',
  border: 'rgba(255,255,255,0.07)',
  borderAccent: 'rgba(184,245,90,0.30)',
  accent: '#b8f55a',
  accentMuted: 'rgba(184,245,90,0.10)',
  negative: '#ff5c5c',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.45)',
  textMuted: 'rgba(255,255,255,0.38)',
  textFaint: 'rgba(255,255,255,0.32)',
}

export const radius = {
  card: 14,
  cardLarge: 16,
  button: 10,
  pill: 999,
}

export const spacing = {
  cardPadding: '20px 22px',
  cardPaddingMetrics: '16px',
  cardPaddingHero: '28px 32px',
  sectionGap: 24,
  gridGap: 10,
  layoutGap: 20,
}

export const typography = {
  fontUI: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontDisplay: "'DM Serif Display', serif",
  fontMono: "'DM Mono', ui-monospace, monospace",
  labelSmall: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: 'rgba(255,255,255,0.32)',
  },
  valueHero: {
    fontSize: 'clamp(32px, 5vw, 56px)',
    fontWeight: 900,
  },
  valueLarge: {
    fontSize: 22,
    fontWeight: 800,
  },
  valueMedium: {
    fontSize: 20,
    fontWeight: 800,
  },
}

export const layout = {
  maxWidth: 'min(1200px, calc(100% - 32px))',
}

export const cardStyle = {
  background: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.card,
  padding: spacing.cardPadding,
}

export const cardAccentStyle = {
  background: `linear-gradient(135deg, ${colors.accentMuted}, rgba(184,245,90,0.02))`,
  border: `1px solid ${colors.borderAccent}`,
  borderRadius: radius.card,
  padding: spacing.cardPadding,
}
