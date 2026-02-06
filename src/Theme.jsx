import { createTheme, ThemeProvider } from '@mui/material/styles';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00f2ff', // Neon Cyan
    },
    secondary: {
      main: '#7000ff', // Purple
    },
    background: {
      default: '#050505',
      paper: '#0a0a0f',
    },
    text: {
      primary: '#e9ecef',
      secondary: '#adb5bd',
    },
    action: {
      hover: 'rgba(0, 242, 255, 0.08)',
    }
  },
  typography: {
    fontFamily: '"Space Grotesk", "Inter", "sans-serif"',
    h1: { fontFamily: 'Orbitron, sans-serif' },
    h2: { fontFamily: 'Orbitron, sans-serif' },
    h3: { fontFamily: 'Orbitron, sans-serif' },
    h4: { fontFamily: 'Orbitron, sans-serif' },
    h5: { fontFamily: 'Orbitron, sans-serif' },
    h6: { fontFamily: 'Orbitron, sans-serif' },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#050505',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        containedPrimary: {
          boxShadow: '0 0 15px rgba(0, 242, 255, 0.3)',
          '&:hover': {
            boxShadow: '0 0 25px rgba(0, 242, 255, 0.5)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
  },
});

export default function AppThemeProvider({ children }) {
  return <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>;
}
