import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
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
  Container,
  Card,
  CardContent,
  CardActions,
  Divider,
} from '@mui/material';
import { ContentCopy as ContentCopyIcon, Check as CheckIcon, Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import LogoutIcon from '@mui/icons-material/Logout';
import { motion } from 'framer-motion';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, getDoc, query, where, writeBatch, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
  const [userCode, setUserCode] = useState<string>('');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });
  const [copied, setCopied] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPartnerCode, setNewPartnerCode] = useState('');

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
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          console.error('Documento do usuário não encontrado');
          setSnackbar({
            open: true,
            message: 'Erro ao carregar dados do usuário. Por favor, faça login novamente.',
            severity: 'error',
          });
          navigate('/login');
          return;
        }

        setUserCode(userDoc.data().code);

        // Configurar listener em tempo real para parceiros
        const partnersCollection = collection(db, 'users', currentUser.uid, 'partners');
        const unsubscribe = onSnapshot(partnersCollection, (snapshot) => {
          const partnersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Partner[];
          
          setPartners(partnersData);
          setLoading(false);
        }, (error) => {
          console.error('Erro ao carregar parceiros:', error);
          setSnackbar({
            open: true,
            message: 'Erro ao carregar parceiros. Verifique sua conexão.',
            severity: 'error',
          });
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Erro geral:', error);
        setSnackbar({
          open: true,
          message: 'Ocorreu um erro. Tente novamente mais tarde.',
          severity: 'error',
        });
        setLoading(false);
      }
    };

    loadPartners();
  }, [navigate]);

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

  const handleAcceptPartner = async (partnerId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('Usuário não autenticado');
        return;
      }

      const batch = writeBatch(db);
      
      // Referência para o documento do parceiro no meu subdiretório
      const myPartnerRef = doc(db, 'users', currentUser.uid, 'partners', partnerId);
      
      // Referência para o meu documento no subdiretório do parceiro
      const theirPartnerRef = doc(db, 'users', partnerId, 'partners', currentUser.uid);
      
      // Atualizar ambos os documentos
      batch.update(myPartnerRef, { 
        status: 'accepted',
        lastUpdated: serverTimestamp()
      });
      
      batch.update(theirPartnerRef, { 
        status: 'accepted',
        lastUpdated: serverTimestamp()
      });

      await batch.commit();

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
      if (!currentUser) {
        console.error('Usuário não autenticado');
        return;
      }

      const batch = writeBatch(db);
      
      // Referência para o documento do parceiro no meu subdiretório
      const myPartnerRef = doc(db, 'users', currentUser.uid, 'partners', partnerId);
      
      // Referência para o meu documento no subdiretório do parceiro
      const theirPartnerRef = doc(db, 'users', partnerId, 'partners', currentUser.uid);
      
      // Atualizar ambos os documentos
      batch.update(myPartnerRef, { 
        status: 'rejected',
        lastUpdated: serverTimestamp()
      });
      
      batch.update(theirPartnerRef, { 
        status: 'rejected',
        lastUpdated: serverTimestamp()
      });

      await batch.commit();

      setSnackbar({
        open: true,
        message: 'Parceria rejeitada.',
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

  const handleSendPartnerRequest = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('Usuário não autenticado');
        return;
      }

      if (!newPartnerCode.trim()) {
        setSnackbar({
          open: true,
          message: 'Por favor, insira um código de parceiro.',
          severity: 'warning',
        });
        return;
      }

      // Verificar se o código do parceiro existe
      const partnersQuery = query(
        collection(db, 'users'),
        where('code', '==', newPartnerCode.trim())
      );
      const partnerSnapshot = await getDocs(partnersQuery);

      if (partnerSnapshot.empty) {
        setSnackbar({
          open: true,
          message: 'Código de parceiro inválido.',
          severity: 'error',
        });
        return;
      }

      const partnerDoc = partnerSnapshot.docs[0];
      const partnerId = partnerDoc.id;

      // Verificar se já existe uma parceria
      const existingPartnerQuery = query(
        collection(db, 'users', currentUser.uid, 'partners'),
        where('partnerId', '==', partnerId)
      );
      const existingPartnerSnapshot = await getDocs(existingPartnerQuery);

      if (!existingPartnerSnapshot.empty) {
        setSnackbar({
          open: true,
          message: 'Você já tem uma parceria com este usuário.',
          severity: 'warning',
        });
        return;
      }

      const batch = writeBatch(db);

      // Criar documento de parceria para o usuário atual
      const myPartnerRef = doc(collection(db, 'users', currentUser.uid, 'partners'));
      batch.set(myPartnerRef, {
        partnerId,
        name: partnerDoc.data().name,
        avatar: partnerDoc.data().avatar || '',
        online: partnerDoc.data().online || false,
        code: partnerDoc.data().code,
        status: 'pending',
        requestedBy: currentUser.uid,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });

      // Criar documento de parceria para o parceiro
      const theirPartnerRef = doc(collection(db, 'users', partnerId, 'partners'));
      batch.set(theirPartnerRef, {
        partnerId: currentUser.uid,
        name: currentUser.displayName || 'Usuário',
        avatar: currentUser.photoURL || '',
        online: true,
        code: userCode,
        status: 'pending',
        requestedBy: currentUser.uid,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });

      await batch.commit();

      setOpenDialog(false);
      setNewPartnerCode('');
      setSnackbar({
        open: true,
        message: 'Solicitação de parceria enviada com sucesso!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao enviar solicitação. Tente novamente.',
        severity: 'error',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Aceito';
      case 'rejected':
        return 'Rejeitado';
      case 'pending':
        return 'Pendente';
      default:
        return status;
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" component="h1" gutterBottom>
              Dashboard
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Sair
            </Button>
          </Box>

          <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Seu Código
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <TextField
                  fullWidth
                  value={userCode}
                  InputProps={{
                    readOnly: true,
                  }}
                  variant="outlined"
                />
                <IconButton
                  color={copied ? 'success' : 'primary'}
                  onClick={handleCopy}
                  sx={{ minWidth: 100 }}
                >
                  {copied ? <CheckIcon /> : <ContentCopyIcon />}
                </IconButton>
              </Box>
            </CardContent>
          </Card>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" component="h2">
              Parceiros
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              Adicionar Parceiro
            </Button>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : partners.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Você ainda não tem parceiros. Adicione um usando o botão acima.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {partners.map((partner) => (
                <Card key={partner.id}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar
                        src={partner.avatar}
                        alt={partner.name}
                        sx={{ width: 56, height: 56 }}
                      />
                      <Box flex={1}>
                        <Typography variant="h6">{partner.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Código: {partner.code}
                        </Typography>
                        <Chip
                          label={getStatusText(partner.status)}
                          color={getStatusColor(partner.status)}
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                  <Divider />
                  <CardActions>
                    {partner.status === 'pending' && partner.requestedBy !== auth.currentUser?.uid && (
                      <>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<CheckIcon />}
                          onClick={() => handleAcceptPartner(partner.partnerId)}
                        >
                          Aceitar
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<CloseIcon />}
                          onClick={() => handleRejectPartner(partner.partnerId)}
                        >
                          Rejeitar
                        </Button>
                      </>
                    )}
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}
        </Paper>
      </motion.div>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Adicionar Parceiro</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Código do Parceiro"
            type="text"
            fullWidth
            value={newPartnerCode}
            onChange={(e) => setNewPartnerCode(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button onClick={handleSendPartnerRequest} variant="contained" color="primary">
            Enviar Solicitação
          </Button>
        </DialogActions>
      </Dialog>

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
    </Container>
  );
};

export default Dashboard; 