import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Google as GoogleIcon } from '@mui/icons-material';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Função para gerar código único
const generateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUserDocument = async (user: any) => {
    try {
      console.log('Verificando documento do usuário...');
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log('Criando novo documento de usuário...');
        const newCode = generateCode();
        
        // Criar o documento do usuário
        await setDoc(userDocRef, {
          name: user.displayName || 'Usuário',
          email: user.email,
          code: newCode,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
        
        console.log('Documento do usuário criado com sucesso');
      } else {
        console.log('Atualizando documento do usuário existente...');
        // Atualizar último login
        await setDoc(userDocRef, {
          lastLogin: serverTimestamp(),
        }, { merge: true });
        console.log('Documento do usuário atualizado com sucesso');
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao criar/atualizar documento do usuário:', error);
      throw error;
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Iniciando processo de login com Google...');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
        auth_type: 'reauthenticate'
      });
      
      const result = await signInWithPopup(auth, provider);
      console.log('Login bem sucedido:', result.user.email);
      
      // Criar/atualizar documento do usuário
      console.log('Criando/atualizando documento do usuário...');
      const success = await createUserDocument(result.user);
      
      if (!success) {
        throw new Error('Falha ao criar documento do usuário');
      }
      
      console.log('Documento do usuário criado/atualizado com sucesso, navegando para o dashboard...');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Erro no login:', error);
      if (error.code === 'auth/popup-blocked') {
        setError('O popup de login foi bloqueado. Por favor, permita popups para este site.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError('O popup de login foi fechado. Por favor, tente novamente.');
      } else {
        setError('Erro ao fazer login com Google. Por favor, tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log('Logout realizado com sucesso');
      setError(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      setError('Erro ao fazer logout. Tente novamente.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255, 0, 0, 0.1) 0%, transparent 50%)',
          animation: 'pulse 4s ease-in-out infinite',
        },
        '@keyframes pulse': {
          '0%': {
            opacity: 0.3,
            transform: 'scale(1)',
          },
          '50%': {
            opacity: 0.5,
            transform: 'scale(1.2)',
          },
          '100%': {
            opacity: 0.3,
            transform: 'scale(1)',
          },
        },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            background: alpha('#000000', 0.8),
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -50,
              left: -50,
              width: 100,
              height: 100,
              background: 'radial-gradient(circle, rgba(255, 0, 0, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -50,
              right: -50,
              width: 100,
              height: 100,
              background: 'radial-gradient(circle, rgba(255, 0, 0, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              mb: 3,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -20,
                left: -20,
                width: 40,
                height: 40,
                background: 'radial-gradient(circle, rgba(255, 0, 0, 0.3) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'float 3s ease-in-out infinite',
              },
              '@keyframes float': {
                '0%, 100%': {
                  transform: 'translateY(0)',
                },
                '50%': {
                  transform: 'translateY(-10px)',
                },
              },
            }}
          >
            <GoogleIcon 
              sx={{ 
                fontSize: 60, 
                color: '#ff4444',
                filter: 'drop-shadow(0 0 10px rgba(255, 68, 68, 0.5))',
              }} 
            />
          </Box>

          <Typography 
            component="h1" 
            variant="h3" 
            gutterBottom
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(45deg, #ff4444, #ff6b6b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textAlign: 'center',
              mb: 1,
            }}
          >
            SexMatch
          </Typography>
          
          <Typography 
            variant="subtitle1" 
            sx={{ 
              mb: 4, 
              color: 'rgba(255, 255, 255, 0.7)',
              textAlign: 'center',
              maxWidth: '80%',
            }}
          >
            Descubra suas afinidades e encontre o match perfeito
          </Typography>
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                width: '100%', 
                mb: 2,
                background: 'rgba(255, 0, 0, 0.1)',
                border: '1px solid rgba(255, 0, 0, 0.2)',
                color: '#ff4444',
              }}
            >
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
            onClick={handleGoogleLogin}
            disabled={loading}
            sx={{
              mt: 2,
              py: 1.5,
              px: 4,
              background: 'linear-gradient(45deg, #4285f4, #34a853)',
              color: 'white',
              borderRadius: 50,
              fontSize: '1.1rem',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 15px rgba(66, 133, 244, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'linear-gradient(45deg, #357abd, #2d8a46)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(66, 133, 244, 0.4)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
            }}
          >
            {loading ? 'Entrando...' : 'Entrar com Google'}
          </Button>

          {auth.currentUser && (
            <Box 
              sx={{ 
                mt: 3, 
                textAlign: 'center',
                p: 2,
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.05)',
                width: '100%',
              }}
            >
              <Typography variant="body2" gutterBottom sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Logado como: {auth.currentUser.email}
              </Typography>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleLogout}
                sx={{ 
                  mt: 1,
                  borderColor: 'rgba(255, 68, 68, 0.5)',
                  color: '#ff4444',
                  '&:hover': {
                    borderColor: '#ff4444',
                    background: 'rgba(255, 68, 68, 0.1)',
                  },
                }}
              >
                Sair
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}; 