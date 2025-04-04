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
import { ContentCopy as ContentCopyIcon, Check as CheckIcon, Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import LogoutIcon from '@mui/icons-material/Logout';
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
  status: 'pending' | 'accepted' | 'rejected';
  requestedBy: string;
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

      // Criar solicitação de parceria
      const myPartnersRef = collection(db, 'users', currentUser.uid, 'partners');
      const partnerPartnersRef = collection(db, 'users', partnerId, 'partners');

      const batch = writeBatch(db);

      // Adicionar solicitação para o usuário atual
      const newPartnerRef = doc(myPartnersRef);
      batch.set(newPartnerRef, {
        name: newPartnerName,
        avatar: '👤',
        online: false,
        code: newPartnerCode,
        partnerId: partnerId,
        status: 'pending' as const,
        requestedBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      // Adicionar solicitação para o parceiro
      const reversePartnerRef = doc(partnerPartnersRef);
      batch.set(reversePartnerRef, {
        name: currentUser.displayName || 'Usuário',
        avatar: '👤',
        online: true,
        code: userCode,
        partnerId: currentUser.uid,
        status: 'pending' as const,
        requestedBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      // Atualizar estado local
      const newPartner: Partner = {
        id: newPartnerRef.id,
        name: newPartnerName,
        avatar: '👤',
        online: false,
        code: newPartnerCode,
        partnerId: partnerId,
        status: 'pending' as const,
        requestedBy: currentUser.uid,
      };

      setPartners(prev => [...prev, newPartner]);
      setOpenDialog(false);
      setNewPartnerName('');
      setNewPartnerCode('');
      setSnackbar({
        open: true,
        message: 'Solicitação de parceria enviada!',
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

  const handleAcceptPartner = async (partnerId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const partnerRef = doc(db, 'users', currentUser.uid, 'partners', partnerId);
      const myRef = doc(db, 'users', partnerId, 'partners', currentUser.uid);

      const batch = writeBatch(db);
      batch.update(partnerRef, { status: 'accepted' });
      batch.update(myRef, { status: 'accepted' });
      await batch.commit();

      setPartners(prev =>
        prev.map(p =>
          p.id === partnerId ? { ...p, status: 'accepted' } : p
        )
      );

      setSnackbar({
        open: true,
        message: 'Parceria aceita com sucesso!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erro ao aceitar parceiro:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao aceitar parceiro. Tente novamente.',
        severity: 'error',
      });
    }
  };

  const handleRejectPartner = async (partnerId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const partnerRef = doc(db, 'users', currentUser.uid, 'partners', partnerId);
      const myRef = doc(db, 'users', partnerId, 'partners', currentUser.uid);

      const batch = writeBatch(db);
      batch.delete(partnerRef);
      batch.delete(myRef);
      await batch.commit();

      setPartners(prev => prev.filter(p => p.id !== partnerId));

      setSnackbar({
        open: true,
        message: 'Solicitação rejeitada',
        severity: 'info',
      });
    } catch (error) {
      console.error('Erro ao rejeitar parceiro:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao rejeitar parceiro. Tente novamente.',
        severity: 'error',
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        height: '100%',
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, sm: 3 },
        gap: 3,
      }}
    >
      {/* Header with Logout */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton
          onClick={handleLogout}
          sx={{
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
          }}
        >
          <LogoutIcon />
        </IconButton>
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
      <Paper
        elevation={0}
        sx={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: 0,
          borderRadius: 2,
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <IconButton
            onClick={() => setOpenDialog(true)}
            sx={{
              color: '#ff4444',
              bgcolor: 'rgba(0, 0, 0, 0.3)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                transform: 'scale(1.1)',
              },
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress sx={{ color: '#ff4444' }} />
          </Box>
        ) : partners.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Você ainda não tem parceiros. Adicione um parceiro usando seu código!
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {partners.map((partner) => (
              <ListItem
                key={partner.id}
                sx={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: partner.online ? '#4CAF50' : 'rgba(255, 255, 255, 0.2)',
                      fontSize: '1.2rem',
                    }}
                  >
                    {partner.avatar}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography sx={{ color: 'white', fontWeight: 500 }}>
                      {partner.name}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip
                        label={partner.code}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255, 68, 68, 0.2)',
                          color: '#ff4444',
                          fontFamily: 'monospace',
                        }}
                      />
                      <Chip
                        label={partner.status === 'pending' ? 'Pendente' : partner.status === 'accepted' ? 'Aceito' : 'Rejeitado'}
                        size="small"
                        sx={{
                          bgcolor: partner.status === 'accepted' 
                            ? 'rgba(76, 175, 80, 0.2)' 
                            : partner.status === 'pending' 
                              ? 'rgba(255, 152, 0, 0.2)' 
                              : 'rgba(244, 67, 54, 0.2)',
                          color: partner.status === 'accepted' 
                            ? '#4CAF50' 
                            : partner.status === 'pending' 
                              ? '#FF9800' 
                              : '#F44336',
                        }}
                      />
                    </Box>
                  }
                />
                {partner.status === 'pending' && partner.requestedBy !== auth.currentUser?.uid && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      onClick={() => handleAcceptPartner(partner.id)}
                      sx={{
                        color: '#4CAF50',
                        bgcolor: 'rgba(76, 175, 80, 0.1)',
                        '&:hover': {
                          bgcolor: 'rgba(76, 175, 80, 0.2)',
                        },
                      }}
                    >
                      <CheckIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleRejectPartner(partner.id)}
                      sx={{
                        color: '#F44336',
                        bgcolor: 'rgba(244, 67, 54, 0.1)',
                        '&:hover': {
                          bgcolor: 'rgba(244, 67, 54, 0.2)',
                        },
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
                )}
                {partner.status === 'accepted' && (
                  <Button
                    variant="contained"
                    onClick={() => navigate(`/game/${partner.partnerId}`)}
                    sx={{
                      bgcolor: '#ff4444',
                      '&:hover': {
                        bgcolor: '#ff6666',
                      },
                    }}
                  >
                    Jogar
                  </Button>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Add Partner Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            color: 'white',
            minWidth: { xs: '90%', sm: 400 },
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          Adicionar Parceiro
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
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.4)',
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
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.4)',
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
                bgcolor: '#ff6666',
              },
            }}
          >
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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