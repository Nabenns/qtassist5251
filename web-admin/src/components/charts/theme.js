import { useMemo } from 'react';
import { useTheme } from '../../lib/theme.jsx';

/**
 * Resolve current theme colors at component level so chart series stay
 * readable when the user toggles dark mode without a remount.
 */
export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    if (theme === 'dark') {
      return {
        text: 'rgb(148 163 184)',
        muted: 'rgb(100 116 139 / 0.4)',
        grid: 'rgb(39 45 58)',
        tooltipBg: 'rgb(28 33 43)',
        tooltipText: 'rgb(226 232 240)',
        tooltipBorder: 'rgb(51 65 85)',
        primary: 'rgb(129 140 248)',
        success: 'rgb(74 222 128)',
        warning: 'rgb(250 204 21)',
        danger: 'rgb(248 113 113)',
        info: 'rgb(96 165 250)',
        neutral: 'rgb(148 163 184)'
      };
    }
    return {
      text: 'rgb(100 116 139)',
      muted: 'rgb(148 163 184)',
      grid: 'rgb(226 232 240)',
      tooltipBg: 'rgb(255 255 255)',
      tooltipText: 'rgb(15 23 42)',
      tooltipBorder: 'rgb(226 232 240)',
      primary: 'rgb(79 70 229)',
      success: 'rgb(22 163 74)',
      warning: 'rgb(217 119 6)',
      danger: 'rgb(220 38 38)',
      info: 'rgb(37 99 235)',
      neutral: 'rgb(100 116 139)'
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
