import { useMemo } from 'react';
import { useTheme } from '../../lib/theme.jsx';

/**
 * Read a `--token` from <html> as a triple like `45 212 191` and return
 * `rgb(45 212 191)`. Falls back to a sensible default when SSR/jsdom doesn't
 * expose computed styles.
 */
function readVar(name, fallback) {
  if (typeof window === 'undefined' || !document?.documentElement) return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  return `rgb(${raw})`;
}

function readVarAlpha(name, alpha, fallback) {
  if (typeof window === 'undefined' || !document?.documentElement) return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  return `rgb(${raw} / ${alpha})`;
}

/**
 * Resolve current theme colors at component level so chart series stay
 * readable when the user toggles dark mode without a remount. Values are
 * pulled from the `--token` CSS variables defined in index.css so the chart
 * palette automatically tracks the design tokens.
 */
export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    const isDark = theme === 'dark';
    return {
      // Axis labels — readable mid-tone on either bg
      text: readVar('--muted-fg', isDark ? 'rgb(126 182 180)' : 'rgb(100 116 139)'),
      // Subtle muted accents (legend dots etc.)
      muted: readVarAlpha('--fg-muted', 0.6, isDark ? 'rgb(90 115 120 / 0.6)' : 'rgb(148 163 184 / 0.6)'),
      // Gridlines — soft border tone
      grid: readVarAlpha('--border', isDark ? 0.6 : 1, isDark ? 'rgb(31 65 71 / 0.6)' : 'rgb(226 232 240)'),
      // Tooltip surface
      tooltipBg: readVar('--surface', isDark ? 'rgb(13 35 41)' : 'rgb(255 255 255)'),
      tooltipText: readVar('--fg', isDark ? 'rgb(232 244 241)' : 'rgb(15 23 42)'),
      tooltipBorder: readVar('--border', isDark ? 'rgb(31 65 71)' : 'rgb(226 232 240)'),
      // Series colors — track design tokens
      primary: readVar('--primary', isDark ? 'rgb(45 212 191)' : 'rgb(79 70 229)'),
      success: readVar('--success', isDark ? 'rgb(127 255 170)' : 'rgb(22 163 74)'),
      warning: readVar('--warning', isDark ? 'rgb(250 204 21)' : 'rgb(217 119 6)'),
      danger: readVar('--danger', isDark ? 'rgb(255 107 107)' : 'rgb(220 38 38)'),
      info: readVar('--info', isDark ? 'rgb(96 165 250)' : 'rgb(37 99 235)'),
      neutral: readVar('--muted-fg', isDark ? 'rgb(126 182 180)' : 'rgb(100 116 139)')
    };
  }, [theme]);
}

export function ChartTooltip({ colors, valueFormatter, children }) {
  // Sentinel component used only as a marker; real tooltip content is
  // rendered inline by `renderTooltip` below. This file just exports the
  // helper for tooltip styles.
  return null;
}

export function tooltipContentStyle(colors) {
  return {
    backgroundColor: colors.tooltipBg,
    color: colors.tooltipText,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.10)'
  };
}

export function tooltipLabelStyle(colors) {
  return {
    color: colors.tooltipText,
    fontWeight: 600
  };
}

export function tooltipItemStyle(colors) {
  return {
    color: colors.tooltipText
  };
}
