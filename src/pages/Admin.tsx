import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  FormHelperText,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ImageIcon from '@mui/icons-material/Image';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadImage, getDefaultImageUrl } from '../services/imageService';

interface CardData {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
}

// Senha do admin - em produção, isso deve vir de uma variável de ambiente
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning';
}

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  image?: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cards, setCards] = useState<CardData[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    image: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Função para criar cartas iniciais
  const createInitialCards = async () => {
    console.log('Iniciando criação das cartas iniciais...');
    const initialCards = [
      {
        id: 'massagem-sensual',
        title: 'Massagem Sensual',
        description: 'Uma massagem relaxante que evolui para toques mais íntimos, explorando cada centímetro do corpo com óleos aromáticos.',
        category: 'Relaxamento',
        image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      },
      {
        id: 'jantar-romantico',
        title: 'Jantar Romântico',
        description: 'Um jantar à luz de velas seguido de uma noite de prazer, explorando novos fetiches e desejos.',
        category: 'Romântico',
        image: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      },
      {
        id: 'danca-ventre',
        title: 'Dança do Ventre',
        description: 'Uma dança sensual e envolvente que desperta os sentidos e aumenta o desejo.',
        category: 'Fantasias',
        image: 'https://images.unsplash.com/photo-1545959570-a94084071b5d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      },
      // Reduzindo o número de cartas iniciais para teste
    ];

    try {
      console.log('Obtendo referência da coleção cards...');
      const cardsCollection = collection(db, 'cards');

      console.log('Iniciando criação das cartas uma a uma...');
      for (const card of initialCards) {
        console.log(`Criando carta: ${card.title}`);
        try {
          const docRef = doc(cardsCollection, card.id);
          await setDoc(docRef, {
            title: card.title,
            description: card.description,
            category: card.category,
            image: card.image,
          });
          console.log(`Carta ${card.title} criada com sucesso!`);
        } catch (cardError) {
          console.error(`Erro ao criar carta ${card.title}:`, cardError);
          throw new Error(`Falha ao criar carta ${card.title}: ${cardError instanceof Error ? cardError.message : 'Erro desconhecido'}`);
        }
      }

      console.log('Todas as cartas iniciais foram criadas com sucesso!');
      setSnackbar({
        open: true,
        message: 'Cartas iniciais criadas com sucesso!',
        severity: 'success',
      });
      
      // Recarrega as cartas após criar
      console.log('Recarregando lista de cartas...');
      await loadCards();
    } catch (error) {
      console.error('Erro detalhado ao criar cartas iniciais:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? `Erro ao criar cartas iniciais: ${error.message}` : 'Erro ao criar cartas iniciais',
        severity: 'error',
      });
      throw error; // Re-throw para que o loadCards possa tratar
    }
  };

  // Carregar todas as cartas do Firebase
  const loadCards = async () => {
    setLoading(true);
    try {
      console.log('Iniciando carregamento das cartas...');
      const cardsCollection = collection(db, 'cards');
      console.log('Buscando documentos da coleção cards...');
      const cardsSnapshot = await getDocs(cardsCollection);
      
      if (cardsSnapshot.empty) {
        console.log('Nenhuma carta encontrada no banco de dados');
        setCards([]);
        // Se não houver cartas, cria as iniciais
        console.log('Criando cartas iniciais...');
        await createInitialCards();
        return;
      }

      console.log(`Encontradas ${cardsSnapshot.size} cartas`);
      const cardsData = cardsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          category: data.category || '',
          image: data.image || '',
        };
      }) as CardData[];

      console.log('Cartas carregadas com sucesso:', cardsData);
      setCards(cardsData);
      
      setSnackbar({
        open: true,
        message: 'Cartas carregadas com sucesso!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erro detalhado ao carregar cartas:', error);
      setCards([]); // Reseta o estado em caso de erro
      setSnackbar({
        open: true,
        message: error instanceof Error ? `Erro ao carregar cartas: ${error.message}` : 'Erro ao carregar cartas',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCards();
    }
  }, [isAuthenticated]);

  const categories = [
    'Romântico',
    'Fantasias',
    'Relaxamento',
    'Diversão',
    'Exploração',
    'Novo',
  ];

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Senha incorreta');
    }
  };

  const handleOpenDialog = (card?: CardData) => {
    if (card) {
      setEditingCard(card);
      setFormData({
        title: card.title,
        description: card.description,
        category: card.category,
        image: card.image,
      });
    } else {
      setEditingCard(null);
      setFormData({
        title: '',
        description: '',
        category: '',
        image: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCard(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      image: '',
    });
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    if (!formData.title.trim()) {
      errors.title = 'O título é obrigatório';
      isValid = false;
    }

    if (!formData.description.trim()) {
      errors.description = 'A descrição é obrigatória';
      isValid = false;
    }

    if (!formData.category) {
      errors.category = 'A categoria é obrigatória';
      isValid = false;
    }

    if (!formData.image) {
      errors.image = 'A imagem é obrigatória';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setSnackbar({
        open: true,
        message: 'Por favor, preencha todos os campos obrigatórios',
        severity: 'error',
      });
      return;
    }

    try {
      if (editingCard) {
        // Atualizar carta existente
        const cardRef = doc(db, 'cards', editingCard.id);
        await updateDoc(cardRef, formData);
        setCards(cards.map(card => 
          card.id === editingCard.id 
            ? { ...card, ...formData }
            : card
        ));
        setSnackbar({
          open: true,
          message: 'Carta atualizada com sucesso!',
          severity: 'success',
        });
      } else {
        // Adicionar nova carta
        const cardsCollection = collection(db, 'cards');
        const docRef = await addDoc(cardsCollection, formData);
        const newCard: CardData = {
          id: docRef.id,
          ...formData,
        };
        setCards([...cards, newCard]);
        setSnackbar({
          open: true,
          message: 'Nova carta criada com sucesso!',
          severity: 'success',
        });
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Erro ao salvar carta:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error 
          ? `Erro ao salvar carta: ${error.message}`
          : 'Erro ao salvar carta',
        severity: 'error',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'cards', id));
      setCards(cards.filter(card => card.id !== id));
      setSnackbar({
        open: true,
        message: 'Carta excluída com sucesso!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erro ao deletar carta:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao excluir carta',
        severity: 'error',
      });
    }
  };

  // Função para limpar todos os dados do aplicativo
  const clearAllAppData = async () => {
    try {
      setLoading(true);
      
      // 1. Limpar todos os parceiros de todos os usuários
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      
      const batch = writeBatch(db);
      
      // Para cada usuário
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        // Limpar parceiros do usuário
        const partnersCollection = collection(db, 'users', userId, 'partners');
        const partnersSnapshot = await getDocs(partnersCollection);
        
        partnersSnapshot.docs.forEach(partnerDoc => {
          batch.delete(partnerDoc.ref);
        });
        
        // Limpar dados do usuário (likedCards, etc)
        batch.update(userDoc.ref, {
          likedCards: [],
          avatar: '👤',
          name: userDoc.data().name || 'Usuário',
        });
      }
      
      // 2. Limpar todas as cartas
      const cardsCollection = collection(db, 'cards');
      const cardsSnapshot = await getDocs(cardsCollection);
      
      cardsSnapshot.docs.forEach(cardDoc => {
        batch.delete(cardDoc.ref);
      });
      
      // Executar todas as operações
      await batch.commit();
      
      // Recriar cartas iniciais
      await createInitialCards();
      
      setSnackbar({
        open: true,
        message: 'Todos os dados do aplicativo foram limpos com sucesso!',
        severity: 'success',
      });
      
      // Recarregar cartas
      await loadCards();
    } catch (error) {
      console.error('Erro ao limpar dados do aplicativo:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao limpar dados do aplicativo',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setSnackbar({
        open: true,
        message: 'Tipo de arquivo não suportado. Use JPEG, PNG, GIF ou WEBP.',
        severity: 'error',
      });
      return;
    }

    // Validar tamanho do arquivo (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setSnackbar({
        open: true,
        message: 'O arquivo é muito grande. O tamanho máximo é 5MB.',
        severity: 'error',
      });
      return;
    }

    try {
      setUploading(true);
      const imageUrl = await uploadImage(file);
      setFormData({ ...formData, image: imageUrl });
      setFormErrors({ ...formErrors, image: undefined });
      setSnackbar({
        open: true,
        message: 'Imagem enviada com sucesso!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      const defaultImageUrl = getDefaultImageUrl(formData.category);
      setFormData({ ...formData, image: defaultImageUrl });
      setSnackbar({
        open: true,
        message: 'Erro ao enviar imagem. Usando imagem padrão.',
        severity: 'warning',
      });
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Paper
          sx={{
            p: 4,
            maxWidth: '400px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Typography variant="h5" sx={{ mb: 3, color: 'white', textAlign: 'center' }}>
            Acesso Admin
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            error={!!error}
            helperText={error}
            sx={{
              mb: 2,
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
          <Button
            fullWidth
            variant="contained"
            onClick={handleLogin}
            sx={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            Entrar
          </Button>
          <Button
            fullWidth
            onClick={() => navigate('/dashboard')}
            sx={{
              mt: 2,
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                color: 'white',
              },
            }}
          >
            Voltar para o Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: '#000000',
      color: 'white',
      p: 3,
    }}>
      <Paper sx={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        p: 3,
        borderRadius: 2,
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Gerenciador de Cartas
          </Typography>
          <Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{
                background: 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.2)',
                },
                mr: 2,
              }}
            >
              Nova Carta
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={clearAllAppData}
              sx={{
                borderColor: 'rgba(255, 68, 68, 0.5)',
                color: '#ff4444',
                '&:hover': {
                  borderColor: '#ff4444',
                  background: 'rgba(255, 68, 68, 0.1)',
                },
                mr: 2,
              }}
            >
              Limpar Todos os Dados
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/dashboard')}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.23)',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                },
              }}
            >
              Voltar
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress sx={{ color: 'white' }} />
          </Box>
        ) : cards.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Nenhuma carta encontrada
            </Typography>
            <Button
              variant="contained"
              onClick={createInitialCards}
              sx={{
                background: 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              Criar Cartas Iniciais
            </Button>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {cards.map((card) => (
              <Box 
                key={card.id} 
                sx={{ 
                  width: {
                    xs: '100%',
                    sm: '50%',
                    md: '33.33%'
                  },
                  p: 1
                }}
              >
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <CardMedia
                    component="img"
                    height="200"
                    image={card.image}
                    alt={card.title}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
                      {card.description}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip 
                        label={card.category}
                        sx={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                        }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(card)}
                          sx={{ color: 'white', mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(card.id)}
                          sx={{ color: '#ff4444' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Grid>
        )}
      </Paper>

      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        PaperProps={{
          sx: {
            background: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            minWidth: { xs: '90%', sm: '500px' },
          }
        }}
      >
        <DialogTitle sx={{ color: 'white' }}>
          {editingCard ? 'Editar Carta' : 'Nova Carta'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Título"
              fullWidth
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                setFormErrors({ ...formErrors, title: undefined });
              }}
              error={!!formErrors.title}
              helperText={formErrors.title}
              sx={{
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
              label="Descrição"
              fullWidth
              multiline
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{
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
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Categoria
              </InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                sx={{
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.23)',
                  },
                }}
              >
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                label="URL da Imagem"
                fullWidth
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                sx={{
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
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <Button
                variant="contained"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                startIcon={uploading ? <CircularProgress size={20} /> : <ImageIcon />}
                sx={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  minWidth: '120px',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              >
                {uploading ? 'Carregando...' : 'Upload'}
              </Button>
            </Box>

            {formData.image && (
              <Box sx={{ mt: 2, position: 'relative' }}>
                <img
                  src={formData.image}
                  alt="Preview"
                  style={{
                    width: '100%',
                    height: '200px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                  }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={handleCloseDialog}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            sx={{
              background: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            {editingCard ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default Admin; 