import { MoonIcon, SunIcon, IconButton, useTheme } from '@shared/ui';

export function ThemeToggle({ labelDark, labelLight }: { labelDark: string; labelLight: string }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <IconButton
      label={resolved === 'dark' ? labelLight : labelDark}
      onClick={() => setTheme(next)}
    >
      {resolved === 'dark' ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </IconButton>
  );
}
