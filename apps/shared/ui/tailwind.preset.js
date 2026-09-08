/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
          sunken: 'var(--surface-sunken)',
          hover: 'var(--surface-hover)',
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
        },
        line: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
          foreground: 'var(--accent-foreground)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          muted: 'var(--danger-muted)',
          foreground: 'var(--danger-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          muted: 'var(--success-muted)',
          foreground: 'var(--success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          muted: 'var(--warning-muted)',
          foreground: 'var(--warning-foreground)',
        },
        info: {
          DEFAULT: 'var(--info)',
          muted: 'var(--info-muted)',
          foreground: 'var(--info-foreground)',
        },
        scrim: 'var(--overlay-scrim)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      fontSize: {
        caption: ['9px', { lineHeight: '12px', fontWeight: '400' }],
        label: ['9px', { lineHeight: '12px', fontWeight: '400' }],
        '12': ['12px', { lineHeight: '16px' }],
        '13': ['13px', { lineHeight: '18px' }],
        '14': ['14px', { lineHeight: '20px' }],
        '15': ['15px', { lineHeight: '22px' }],
        '16': ['16px', { lineHeight: '24px' }],
        '17': ['17px', { lineHeight: '26px' }],
        display: ['60px', { lineHeight: '64px', fontWeight: '700' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-md)',
      },
      spacing: {
        1.25: '5px',
        2.75: '11px',
        3.25: '13px',
        3.5: '14px',
        4.75: '19px',
      },
      boxShadow: {
        overlay: 'var(--shadow-overlay)',
      },
      outlineColor: {
        accent: 'var(--focus-ring)',
      },
      maxWidth: {
        content: '1120px',
      },
    },
  },
  plugins: [],
};
