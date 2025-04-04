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
import { collection, addDoc, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
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
          return;
        }

        // Obter o código do usuário atual
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserCode(userDoc.data().code || 'SEX123');
        } else {
          // Criar um novo usuário se não existir
          const newCode = generateCode();
          await setDoc(doc(db, 'users', currentUser.uid), {
            name: currentUser.displayName || 'Usuário',
            email: currentUser.email,
            code: newCode,
            createdAt: new Date(),
          });
          setUserCode(newCode);
        }

        // Carregar parceiros
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
          message: 'Erro ao carregar parceiros',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPartners();
  }, []);

  // Gerar código aleatório
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      // Verificar se o código existe
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      let partnerFound = false;
      let partnerId = '';

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.code === newPartnerCode) {
          partnerFound = true;
          partnerId = userDoc.id;
          break;
        }
      }

      if (!partnerFound) {
        setSnackbar({
          open: true,
          message: 'Código de parceiro não encontrado',
          severity: 'error',
        });
        return;
      }

      // Adicionar parceiro
      const partnerData = {
        name: newPartnerName,
        avatar: '👤',
        online: false,
        code: newPartnerCode,
        partnerId: partnerId,
      };

      const partnersCollection = collection(db, 'users', currentUser.uid, 'partners');
      await addDoc(partnersCollection, partnerData);

      // Adicionar o usuário atual como parceiro do outro usuário
      const partnerPartnersCollection = collection(db, 'users', partnerId, 'partners');
      await addDoc(partnerPartnersCollection, {
        name: currentUser.displayName || 'Usuário',
        avatar: '👤',
        online: true,
        code: userCode,
        partnerId: currentUser.uid,
      });

      setPartners([...partners, { id: Date.now().toString(), ...partnerData }]);
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
        message: 'Erro ao adicionar parceiro',
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
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              p: { xs: 3, sm: 4 },
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              }}
            />
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
              gap: 2, 
              alignItems: 'center',
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                style={{ flex: 1 }}
              >
                <Typography
                  variant="h2"
                  sx={{
                    color: 'white',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    background: 'linear-gradient(90deg, #fff, rgba(255,255,255,0.8))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {userCode}
                </Typography>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <IconButton
                  onClick={handleCopy}
                  sx={{
                    color: 'white',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  {copied ? <CheckIcon /> : <ContentCopyIcon />}
                </IconButton>
              </motion.div>
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
              <List sx={{ p: 0 }}>
                {partners.map((partner, index) => (
                  <motion.div
                    key={partner.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <ListItem
                      sx={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 2,
                        mb: 2,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'rgba(255, 255, 255, 0.06)',
                          transform: 'translateX(8px)',
                        },
                      }}
                      secondaryAction={
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            onClick={() => navigate(`/game/${partner.partnerId}`)}
                            sx={{
                              color: 'white',
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                              backdropFilter: 'blur(10px)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)',
                              },
                            }}
                          >
                            Jogar
                          </Button>
                        </motion.div>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar 
                          sx={{ 
                            bgcolor: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            fontSize: '1.5rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          {partner.avatar}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ 
                              color: 'white',
                              fontWeight: 500,
                            }}>
                              {partner.name}
                            </Typography>
                            <Chip
                              label={partner.online ? 'Online' : 'Offline'}
                              size="small"
                              sx={{
                                background: partner.online 
                                  ? 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)'
                                  : 'rgba(255, 255, 255, 0.05)',
                                color: 'white',
                                borderRadius: '4px',
                                height: '20px',
                                '& .MuiChip-label': {
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                },
                              }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  </motion.div>
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
            background: 'rgba(30, 30, 30, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ color: 'white' }}>Adicionar Parceiro</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nome do Parceiro"
            type="text"
            fullWidth
            variant="outlined"
            value={newPartnerName}
            onChange={(e) => setNewPartnerName(e.target.value)}
            sx={{
              mt: 2,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
            }}
          />
          <TextField
            margin="dense"
            label="Código do Parceiro"
            type="text"
            fullWidth
            variant="outlined"
            value={newPartnerCode}
            onChange={(e) => setNewPartnerCode(e.target.value.toUpperCase())}
            sx={{
              mt: 2,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Cancelar
          </Button>
          <Button onClick={handleAddPartner} variant="contained" sx={{ 
            background: 'linear-gradient(45deg, #4285f4, #34a853)',
            '&:hover': {
              background: 'linear-gradient(45deg, #357abd, #2d8a46)',
            },
          }}>
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para mensagens */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
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