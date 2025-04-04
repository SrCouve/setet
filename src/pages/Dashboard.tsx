import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import { motion } from 'framer-motion';
import { auth, db } from '../firebase';
import { collection, addDoc, getDocs, doc, setDoc, getDoc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface Partner {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  code: string;
  partnerId: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerCode, setNewPartnerCode] = useState('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });
  const [userCode, setUserCode] = useState('');

  // Carregar parceiros do Firestore
  useEffect(() => {
    const loadPartners = async () => {
      try {
        setLoading(true);
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.error('Usuário não autenticado');
          navigate('/login');
          return;
        }

        // Obter o código do usuário atual
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserCode(userDoc.data().code || generateCode());
        } else {
          // Criar um novo usuário se não existir
          const newCode = generateCode();
          try {
            await setDoc(doc(db, 'users', currentUser.uid), {
              name: currentUser.displayName || 'Usuário',
              email: currentUser.email,
              code: newCode,
              createdAt: new Date(),
            });
            setUserCode(newCode);
          } catch (error) {
            console.error('Erro ao criar usuário:', error);
            setSnackbar({
              open: true,
              message: 'Erro ao criar usuário. Tente novamente mais tarde.',
              severity: 'error',
            });
            return;
          }
        }

        // Carregar parceiros
        try {
          const partnersCollection = collection(db, 'users', currentUser.uid, 'partners');
          const partnersSnapshot = await getDocs(partnersCollection);
          const partnersData = partnersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Partner[];

          setPartners(partnersData);
        } catch (error) {
          console.error('Erro ao carregar parceiros:', error);
          setSnackbar({
            open: true,
            message: 'Erro ao carregar parceiros. Verifique sua conexão.',
            severity: 'error',
          });
        }
      } catch (error) {
        console.error('Erro geral:', error);
        setSnackbar({
          open: true,
          message: 'Ocorreu um erro. Tente novamente mais tarde.',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPartners();
  }, [navigate]);

  // Gerar código aleatório
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const prefix = 'SEX';
    let code = prefix;
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setSnackbar({
        open: true,
        message: 'Código copiado com sucesso!',
        severity: 'success',
      });
      setTimeout(() => {
        setCopied(false);
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 2000);
    } catch (error) {
      console.error('Erro ao copiar código:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao copiar código',
        severity: 'error',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleAddPartner = async () => {
    try {
      if (!newPartnerName || !newPartnerCode) {
        setSnackbar({
          open: true,
          message: 'Preencha todos os campos',
          severity: 'error',
        });
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setSnackbar({
          open: true,
          message: 'Usuário não autenticado',
          severity: 'error',
        });
        return;
      }

      // Verificar se está tentando adicionar o próprio código
      if (newPartnerCode === userCode) {
        setSnackbar({
          open: true,
          message: 'Você não pode adicionar seu próprio código',
          severity: 'error',
        });
        return;
      }

      // Verificar se o parceiro já existe
      const existingPartner = partners.find(p => p.code === newPartnerCode);
      if (existingPartner) {
        setSnackbar({
          open: true,
          message: 'Este parceiro já foi adicionado',
          severity: 'error',
        });
        return;
      }

      // Buscar o usuário pelo código
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('code', '==', newPartnerCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setSnackbar({
          open: true,
          message: 'Código de parceiro não encontrado',
          severity: 'error',
        });
        return;
      }

      const partnerDoc = querySnapshot.docs[0];
      const partnerId = partnerDoc.id;
      const partnerData = partnerDoc.data();

      // Verificar se já existe uma conexão bidirecional
      const myPartnersRef = collection(db, 'users', currentUser.uid, 'partners');
      const partnerPartnersRef = collection(db, 'users', partnerId, 'partners');

      const batch = writeBatch(db);

      // Adicionar parceiro para o usuário atual
      const newPartnerRef = doc(myPartnersRef);
      batch.set(newPartnerRef, {
        name: newPartnerName,
        avatar: '👤',
        online: false,
        code: newPartnerCode,
        partnerId: partnerId,
        createdAt: serverTimestamp(),
      });

      // Adicionar usuário atual como parceiro do outro usuário
      const reversePartnerRef = doc(partnerPartnersRef);
      batch.set(reversePartnerRef, {
        name: currentUser.displayName || 'Usuário',
        avatar: '👤',
        online: true,
        code: userCode,
        partnerId: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      // Atualizar estado local
      const newPartner = {
        id: newPartnerRef.id,
        name: newPartnerName,
        avatar: '👤',
        online: false,
        code: newPartnerCode,
        partnerId: partnerId,
      };

      setPartners(prev => [...prev, newPartner]);
      setOpenDialog(false);
      setNewPartnerName('');
      setNewPartnerCode('');
      setSnackbar({
        open: true,
        message: 'Parceiro adicionado com sucesso!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erro ao adicionar parceiro:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao adicionar parceiro. Tente novamente mais tarde.',
        severity: 'error',
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        p: { xs: 2, sm: 4 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '40vh',
          height: '40vh',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          right: '10%',
          width: '30vh',
          height: '30vh',
          background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
          zIndex: 0,
        }}
      />

      {/* Content Container */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* Header with Logout */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <IconButton
              onClick={handleLogout}
              sx={{
                color: 'white',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.15)',
                },
              }}
            >
              <LogoutIcon />
            </IconButton>
          </motion.div>
        </Box>

        {/* Code Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper
            elevation={0}
            sx={{
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              p: { xs: 3, sm: 4 },
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Typography 
              variant="h6"
              sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
                mb: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '0.9rem',
              }}
            >
              Seu Código
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}>
              <Typography
                variant="h2"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: '#ff4444',
                  letterSpacing: '0.2em',
                  fontSize: { xs: '2rem', sm: '3rem' },
                  textShadow: '0 0 20px rgba(255, 68, 68, 0.3)',
                }}
              >
                {userCode}
              </Typography>
              <IconButton
                onClick={handleCopy}
                sx={{
                  color: copied ? '#4CAF50' : '#ff4444',
                  bgcolor: 'rgba(0, 0, 0, 0.3)',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                    transform: 'scale(1.1)',
                  },
                  '&:active': {
                    transform: 'scale(0.95)',
                  },
                }}
              >
                {copied ? <CheckIcon /> : <ContentCopyIcon />}
              </IconButton>
            </Box>
          </Paper>
        </motion.div>

        {/* Partners Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Paper
            elevation={0}
            sx={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              p: { xs: 3, sm: 4 },
              mt: 4,
              borderRadius: 4,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography 
                variant="h6"
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontSize: '0.9rem',
                }}
              >
                Parceiros
              </Typography>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <IconButton
                  onClick={() => setOpenDialog(true)}
                  sx={{
                    color: 'white',
                    background: 'rgba(255, 255, 255, 0.1)',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.15)',
                    },
                  }}
                >
                  <AddIcon />
                </IconButton>
              </motion.div>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : partners.length === 0 ? (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Você ainda não tem parceiros. Adicione um parceiro usando seu código!
                </Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%', bgcolor: 'transparent' }}>
                {partners.map((partner) => (
                  <Paper
                    key={partner.id}
                    elevation={2}
                    sx={{
                      mb: 2,
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                      }
                    }}
                  >
                    <ListItem
                      secondaryAction={
                        <Chip
                          label={partner.code}
                          sx={{
                            bgcolor: 'rgba(255, 68, 68, 0.2)',
                            color: '#ff4444',
                            border: '1px solid rgba(255, 68, 68, 0.3)',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                          }}
                        />
                      }
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: partner.online ? '#4CAF50' : '#ff4444',
                            fontSize: '1.5rem',
                          }}
                        >
                          {partner.avatar}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="h6" sx={{ color: 'white' }}>
                            {partner.name}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            {partner.online ? 'Online' : 'Offline'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </Paper>
                ))}
              </List>
            )}
          </Paper>
        </motion.div>
      </Box>

      {/* Dialog para adicionar parceiro */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            color: 'white',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          Adicionar Novo Parceiro
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Nome do Parceiro"
            fullWidth
            value={newPartnerName}
            onChange={(e) => setNewPartnerName(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: '#ff4444',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#ff4444',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-focused': {
                  color: '#ff4444',
                },
              },
            }}
          />
          <TextField
            margin="dense"
            label="Código do Parceiro"
            fullWidth
            value={newPartnerCode}
            onChange={(e) => setNewPartnerCode(e.target.value.toUpperCase())}
            sx={{
              mt: 2,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: '#ff4444',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#ff4444',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-focused': {
                  color: '#ff4444',
                },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button
            onClick={() => setOpenDialog(false)}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAddPartner}
            variant="contained"
            sx={{
              bgcolor: '#ff4444',
              '&:hover': {
                bgcolor: '#ff6b6b',
              }
            }}
          >
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para mensagens */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard; 