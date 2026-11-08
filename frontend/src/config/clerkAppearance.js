/**
 * Configuración visual de Clerk alineada con los tokens institucionales (Sección 3 y 5 de DISENO_PROPUESTA.md).
 */
export const clerkAppearance = {
  variables: {
    colorBackground: '#FFFFFF',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#1B2430',
    colorText: '#1B2430',
    colorTextSecondary: '#566273',
    colorPrimary: '#1F4E8C',
    colorDanger: '#A4262C',
    borderRadius: '4px',
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif",
    fontSize: '14px'
  },
  elements: {
    rootBox: {
      width: '100%',
      boxShadow: 'none'
    },
    cardBox: {
      boxShadow: 'none',
      border: 'none',
      width: '100%'
    },
    card: {
      background: '#FFFFFF',
      border: '1px solid #D5DAE1',
      boxShadow: 'none',
      borderRadius: '6px',
      padding: '24px'
    },
    headerTitle: {
      color: '#1B2430',
      fontFamily: "'Source Serif 4', Georgia, serif",
      fontSize: '20px',
      fontWeight: '600'
    },
    headerSubtitle: {
      color: '#566273',
      fontSize: '14px'
    },
    socialButtonsBlockButton: {
      background: '#FFFFFF',
      border: '1px solid #8A94A3',
      color: '#1B2430',
      borderRadius: '4px',
      boxShadow: 'none'
    },
    socialButtonsBlockButtonText: {
      color: '#1B2430',
      fontWeight: '500'
    },
    dividerLine: {
      background: '#D5DAE1'
    },
    dividerText: {
      color: '#566273',
      fontSize: '12px'
    },
    formFieldInput: {
      background: '#FFFFFF',
      border: '1px solid #8A94A3',
      color: '#1B2430',
      borderRadius: '4px',
      boxShadow: 'none'
    },
    formFieldLabel: {
      color: '#1B2430',
      fontWeight: '500',
      fontSize: '14px'
    },
    formButtonPrimary: {
      background: '#1F4E8C',
      backgroundImage: 'none',
      borderRadius: '4px',
      fontWeight: '500',
      boxShadow: 'none'
    },
    footer: {
      background: 'transparent',
      border: 'none'
    },
    footerActionText: {
      color: '#566273',
      fontSize: '14px'
    },
    footerActionLink: {
      color: '#1F4E8C',
      fontWeight: '500',
      textDecoration: 'none'
    }
  }
};

export default clerkAppearance;
