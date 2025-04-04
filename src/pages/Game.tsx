import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Paper,
  Avatar,
  Chip,
  Button,
  CardMedia,
  Collapse,
  Modal,
  Fade,
  Container,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface CardData {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  isHot?: boolean;
}

interface Partner {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  likedCards: string[];
  fireCards: string[];
}

const Game = () => {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Estados
  const [cards, setCards] = useState<CardData[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [viewedCards, setViewedCards] = useState<string[]>([]);
  const [likedCards, setLikedCards] = useState<string[]>([]);
  const [fireCards, setFireCards] = useState<string[]>([]);
  const [matchedCards, setMatchedCards] = useState<string[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [hasNewMatch, setHasNewMatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // Referências
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number>(0);
  const dragThreshold = 100;

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const currentUser = auth.currentUser;
        if (!currentUser || !partnerId) {
          setError('Usuário não autenticado ou parceiro não especificado');
          return;
        }

        // Carregar cartas primeiro
        const cardsCollection = collection(db, 'cards');
        const cardsSnapshot = await getDocs(cardsCollection);
        const cardsData = cardsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CardData[];

        if (cardsData.length === 0) {
          setError('Não há cartas disponíveis no momento');
          return;
        }

        // Carregar informações do parceiro
        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
        if (!partnerDoc.exists()) {
          setError('Parceiro não encontrado');
          return;
        }

        const partnerData = partnerDoc.data();
        const partnerLikedCards = partnerData.likedCards || [];
        const partnerFireCards = partnerData.fireCards || [];

        setPartner({
          id: partnerId,
          name: partnerData.name || 'Parceiro',
          avatar: partnerData.avatar || '👤',
          online: true,
          likedCards: partnerLikedCards,
          fireCards: partnerFireCards,
        });

        // Verificar se é uma nova sessão
        const matchDoc = await getDoc(doc(db, 'matches', `${currentUser.uid}_${partnerId}`));
        const matchData = matchDoc.data();

        if (!matchData || !matchData.lastPlayed) {
          // Nova sessão - inicializar com valores vazios
          const initialData = {
            lastPlayed: new Date().toISOString(),
            viewedCards: [],
            likedCards: [],
            fireCards: [],
            matchedCards: []
          };

          await setDoc(doc(db, 'matches', `${currentUser.uid}_${partnerId}`), initialData);
          
          setViewedCards([]);
          setLikedCards([]);
          setFireCards([]);
          setMatchedCards([]);
          setCards(cardsData);
          setCurrentCardIndex(0);
        } else {
          // Sessão existente - carregar dados salvos
          const savedViewedCards = matchData.viewedCards || [];
          const savedLikedCards = matchData.likedCards || [];
          const savedFireCards = matchData.fireCards || [];
          const savedMatchedCards = matchData.matchedCards || [];

          setViewedCards(savedViewedCards);
          setLikedCards(savedLikedCards);
          setFireCards(savedFireCards);
          setMatchedCards(savedMatchedCards);

          // Verificar matches existentes
          const existingMatches = cardsData.filter(card => 
            partnerLikedCards.includes(card.id) && 
            savedLikedCards.includes(card.id) &&
            !savedMatchedCards.includes(card.id)
          );

          if (existingMatches.length > 0) {
            const newMatchedCards = [...savedMatchedCards, ...existingMatches.map(card => card.id)];
            setMatchedCards(newMatchedCards);
            setHasNewMatch(true);
            
            // Atualizar matchedCards no documento de match
            await updateDoc(doc(db, 'matches', `${currentUser.uid}_${partnerId}`), {
              matchedCards: newMatchedCards
            });
          }

          // Filtrar cartas já vistas
          const availableCards = cardsData.filter(card => !savedViewedCards.includes(card.id));
          
          if (availableCards.length > 0) {
            setCards(availableCards);
            setCurrentCardIndex(0);
          } else {
            // Se todas as cartas foram vistas, reiniciar
            setViewedCards([]);
            setCards(cardsData);
            setCurrentCardIndex(0);
            await updateDoc(doc(db, 'matches', `${currentUser.uid}_${partnerId}`), {
              viewedCards: [],
              lastPlayed: new Date().toISOString()
            });
          }
        }

        // Configurar listener para curtidas do parceiro e matches
        const unsubscribe = onSnapshot(doc(db, 'users', partnerId), (docSnapshot) => {
          const data = docSnapshot.data();
          if (data) {
            const partnerLikedCards = data.likedCards || [];
            setPartner(prev => prev ? {
              ...prev,
              likedCards: partnerLikedCards,
              fireCards: data.fireCards || [],
            } : null);
            
            // Verificar novos matches
            const newMatches = cardsData.filter(card => 
              partnerLikedCards.includes(card.id) && 
              likedCards.includes(card.id) &&
              !matchedCards.includes(card.id)
            );
            
            if (newMatches.length > 0) {
              const newMatchedCards = [...matchedCards, ...newMatches.map(card => card.id)];
              setMatchedCards(newMatchedCards);
              setHasNewMatch(true);
              
              // Atualizar matchedCards no documento de match
              const matchRef = doc(db, 'matches', `${currentUser.uid}_${partnerId}`);
              updateDoc(matchRef, {
                matchedCards: newMatchedCards
              });

              setSnackbar({
                open: true,
                message: `Novo match: ${newMatches[0].title}!`,
                severity: 'success',
              });
            }
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setError('Ocorreu um erro ao carregar os dados. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [partnerId]);

  // Funções de interação com cartas
  const handleCardAction = async (action: 'like' | 'skip') => {
    if (currentCardIndex >= cards.length) return;
    
    const currentCard = cards[currentCardIndex];
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    try {
      const matchDoc = doc(db, 'matches', `${currentUser.uid}_${partnerId}`);
      const partnerMatchDoc = doc(db, 'matches', `${partnerId}_${currentUser.uid}`);
      const userDoc = doc(db, 'users', currentUser.uid);
      
      // Adicionar carta às já vistas
      const newViewedCards = [...viewedCards, currentCard.id];
      setViewedCards(newViewedCards);
      
      if (action === 'like') {
        const newLikedCards = [...likedCards, currentCard.id];
        setLikedCards(newLikedCards);
        
        // Atualizar em batch para garantir consistência
        const batch = writeBatch(db);
        
        // Atualizar likedCards no documento do usuário
        batch.update(userDoc, {
          likedCards: arrayUnion(currentCard.id)
        });

        // Atualizar likedCards e viewedCards no documento de match
        batch.update(matchDoc, {
          likedCards: arrayUnion(currentCard.id),
          viewedCards: newViewedCards
        });

        await batch.commit();

        // Verificar se é um match (após o commit do batch)
        if (partner?.likedCards.includes(currentCard.id) && !matchedCards.includes(currentCard.id)) {
          const newMatchedCards = [...matchedCards, currentCard.id];
          setMatchedCards(newMatchedCards);
          setHasNewMatch(true);
          
          // Atualizar matchedCards em ambos os documentos de match
          const batch = writeBatch(db);
          batch.update(matchDoc, {
            matchedCards: arrayUnion(currentCard.id)
          });
          batch.update(partnerMatchDoc, {
            matchedCards: arrayUnion(currentCard.id)
          });
          await batch.commit();

          setSnackbar({
            open: true,
            message: `Novo match: ${currentCard.title}!`,
            severity: 'success',
          });
        }
      } else {
        // Se for skip, apenas atualizar viewedCards
        await updateDoc(matchDoc, {
          viewedCards: newViewedCards
        });
      }

      // Se todas as cartas foram vistas
      if (currentCardIndex === cards.length - 1) {
        try {
          // Recarregar todas as cartas
          const cardsCollection = collection(db, 'cards');
          const cardsSnapshot = await getDocs(cardsCollection);
          const allCards = cardsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as CardData[];

          if (allCards.length > 0) {
            // Limpar histórico de cartas vistas e recarregar todas as cartas
            setViewedCards([]);
            setCards(allCards);
            setCurrentCardIndex(0);
            await updateDoc(matchDoc, {
              viewedCards: [],
              lastPlayed: new Date().toISOString()
            });
          }
        } catch (reloadError) {
          console.error('Erro ao recarregar cartas:', reloadError);
        }
      } else {
        // Avançar para a próxima carta com um pequeno delay para a animação
        setTimeout(() => {
          setCurrentCardIndex(currentCardIndex + 1);
        }, 300);
      }
    } catch (error) {
      console.error('Erro ao processar ação:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao processar ação. Tente novamente.',
        severity: 'error'
      });
    }
  };

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (e.type === 'mousedown') {
      dragStartX.current = (e as React.MouseEvent<HTMLDivElement>).clientX;
    } else if (e.type === 'touchstart') {
      dragStartX.current = (e as React.TouchEvent<HTMLDivElement>).touches[0].clientX;
    }
  };

  const handleDragEnd = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    let endX = 0;
    
    if (e.type === 'mouseup') {
      endX = (e as React.MouseEvent<HTMLDivElement>).clientX;
    } else if (e.type === 'touchend') {
      endX = (e as React.TouchEvent<HTMLDivElement>).changedTouches[0].clientX;
    }
    
    const diff = endX - dragStartX.current;
    
    if (Math.abs(diff) > dragThreshold) {
      if (diff > 0) {
        // Arrastou para a direita (curtir)
        handleCardAction('like');
      } else {
        // Arrastou para a esquerda (pular)
        handleCardAction('skip');
      }
    }
  };

  const handleShowMatches = () => {
    setShowMatches(!showMatches);
    if (hasNewMatch) {
      setHasNewMatch(false);
    }
  };

  const getMatches = () => {
    return cards.filter(card => 
      partner?.likedCards.includes(card.id) && 
      likedCards.includes(card.id)
    );
  };

  const handleToggleFire = async (cardId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const matchDoc = doc(db, 'matches', `${currentUser.uid}_${partnerId}`);
      const newFireCards = fireCards.includes(cardId)
        ? fireCards.filter(id => id !== cardId)
        : [...fireCards, cardId];
      
      setFireCards(newFireCards);
      await updateDoc(matchDoc, {
        fireCards: newFireCards
      });
    } catch (error) {
      console.error('Erro ao atualizar foguinho:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao atualizar foguinho. Tente novamente.',
        severity: 'error'
      });
    }
  };

  const currentCard = cards[currentCardIndex];

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          height: '100%',
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <CircularProgress sx={{ color: '#ff4444', mb: 3 }} />
        <Typography variant="h6">Carregando...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          height: '100%',
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          p: 3,
        }}
      >
        <Paper
          sx={{
            p: 4,
            maxWidth: '500px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
            borderRadius: 2,
          }}
        >
          <Typography variant="h5" sx={{ mb: 2, color: '#ff4444' }}>
            Erro
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, color: 'rgba(255, 255, 255, 0.7)' }}>
            {error}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/dashboard')}
            sx={{
              background: '#ff4444',
              color: 'white',
              '&:hover': {
                background: '#ff6666',
              },
            }}
          >
            Voltar ao Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  if (!currentCard) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          height: '100%',
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: 0,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Tooltip title="Voltar ao Dashboard">
            <IconButton 
              onClick={() => navigate('/dashboard')} 
              sx={{ 
                color: 'white',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'transparent', fontSize: '1.5rem' }}>
              {partner?.avatar}
            </Avatar>
            <Typography variant="h6" sx={{ color: 'white' }}>
              {partner?.name || 'Parceiro'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={showMatches ? "Ocultar Matches" : "Mostrar Matches"}>
              <IconButton
                onClick={handleShowMatches}
                sx={{ color: 'white' }}
              >
                {showMatches ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
              </IconButton>
            </Tooltip>
            {hasNewMatch && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  backgroundColor: '#ff4444',
                  borderRadius: '50%',
                }}
              />
            )}
          </Box>
        </Paper>

        {/* Matches Collapse - Sempre visível quando não há cartas */}
        <Collapse in={true}>
          <Paper
            elevation={0}
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              borderRadius: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '16px',
              overflow: 'hidden',
            }}
          >
            <Typography variant="h6" sx={{ color: 'white', mb: 3 }}>
              Matches com {partner?.name}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                overflowX: 'auto',
                pb: 2,
                '&::-webkit-scrollbar': {
                  height: 8,
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 4,
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 4,
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.3)',
                  },
                },
              }}
            >
              {getMatches().length > 0 ? (
                getMatches().map((card) => (
                  <Card
                    key={card.id}
                    elevation={0}
                    sx={{
                      minWidth: 200,
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      },
                    }}
                    onClick={() => setSelectedCard(card)}
                  >
                    <CardMedia
                      component="img"
                      height={200}
                      image={card.image}
                      alt={card.title}
                      sx={{
                        objectFit: 'cover',
                        filter: 'brightness(0.7)',
                      }}
                    />
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="h6" sx={{ color: 'white', fontSize: '1rem', mb: 1 }}>
                        {card.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          label={card.category}
                          size="small"
                          sx={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            fontSize: '0.7rem',
                          }}
                        />
                        {partner?.fireCards?.includes(card.id) && partner?.likedCards?.includes(card.id) && (
                          <LocalFireDepartmentIcon sx={{ color: '#ff4444', fontSize: '1.2rem' }} />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 4,
                  }}
                >
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
                    Ainda não há matches.
                    <br />
                    Continue jogando para descobrir afinidades!
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Collapse>

        {/* Mensagem de não há mais cartas */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
          }}
        >
          <Paper
            sx={{
              p: 4,
              maxWidth: '500px',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              textAlign: 'center',
              borderRadius: 2,
            }}
          >
            <Typography variant="h5" sx={{ mb: 2, color: 'white' }}>
              Não há mais cartas novas!
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'rgba(255, 255, 255, 0.7)' }}>
              Todas as cartas disponíveis já foram visualizadas.
              <br />
              Aguarde novas cartas serem adicionadas pelo administrador.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/dashboard')}
              sx={{
                background: '#ff4444',
                color: 'white',
                '&:hover': {
                  background: '#ff6666',
                },
              }}
            >
              Voltar ao Dashboard
            </Button>
          </Paper>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        height: '100%',
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: 0,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Tooltip title="Voltar ao Dashboard">
          <IconButton 
            onClick={() => navigate('/dashboard')} 
            sx={{ 
              color: 'white',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: 'transparent', fontSize: '1.5rem' }}>
            {partner?.avatar}
          </Avatar>
          <Typography variant="h6" sx={{ color: 'white' }}>
            {partner?.name || 'Parceiro'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title={showMatches ? "Ocultar Matches" : "Mostrar Matches"}>
            <IconButton
              onClick={handleShowMatches}
              sx={{ color: 'white' }}
            >
              {showMatches ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
            </IconButton>
          </Tooltip>
          {hasNewMatch && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 8,
                height: 8,
                backgroundColor: '#ff4444',
                borderRadius: '50%',
              }}
            />
          )}
        </Box>
      </Paper>

      {/* Matches Collapse */}
      <Collapse in={showMatches}>
        <Paper
          elevation={0}
          sx={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
            backdropFilter: 'blur(10px)',
            borderRadius: 0,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '16px',
            overflow: 'hidden',
          }}
        >
          <Typography variant="h6" sx={{ color: 'white', mb: 3 }}>
            Matches com {partner?.name}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              pb: 2,
              '&::-webkit-scrollbar': {
                height: 8,
              },
              '&::-webkit-scrollbar-track': {
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 4,
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 4,
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.3)',
                },
              },
            }}
          >
            {getMatches().length > 0 ? (
              getMatches().map((card) => (
                <Card
                  key={card.id}
                  elevation={0}
                  sx={{
                    minWidth: 200,
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                    },
                  }}
                  onClick={() => setSelectedCard(card)}
                >
                  <CardMedia
                    component="img"
                    height={200}
                    image={card.image}
                    alt={card.title}
                    sx={{
                      objectFit: 'cover',
                      filter: 'brightness(0.7)',
                    }}
                  />
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontSize: '1rem', mb: 1 }}>
                      {card.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={card.category}
                        size="small"
                        sx={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          fontSize: '0.7rem',
                        }}
                      />
                      {partner?.fireCards?.includes(card.id) && partner?.likedCards?.includes(card.id) && (
                        <LocalFireDepartmentIcon sx={{ color: '#ff4444', fontSize: '1.2rem' }} />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Box
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 4,
                }}
              >
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
                  Ainda não há matches.
                  <br />
                  Continue jogando para descobrir afinidades!
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Collapse>

      {/* Modal for card details */}
      <Modal
        open={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
        closeAfterTransition
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Fade in={selectedCard !== null}>
          <Box
            sx={{
              width: '90%',
              maxWidth: '600px',
              background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
              p: { xs: 3, sm: 5 },
              outline: 'none',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              position: 'relative',
            }}
          >
            {selectedCard && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardMedia
                  component="img"
                  sx={{
                    height: { xs: '200px', sm: '300px' },
                    objectFit: 'cover',
                    borderRadius: 1,
                    mb: 3,
                  }}
                  image={selectedCard.image}
                  alt={selectedCard.title}
                />
                <Typography variant="h5" sx={{ color: 'white', mb: 2 }}>
                  {selectedCard.title}
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 3 }}>
                  {selectedCard.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip
                    label={selectedCard.category}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                    }}
                  />
                  {partner?.fireCards?.includes(selectedCard.id) && partner?.likedCards?.includes(selectedCard.id) && (
                    <LocalFireDepartmentIcon sx={{ color: '#ff4444', fontSize: '1.2rem' }} />
                  )}
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 2,
                    display: 'flex',
                    gap: 1,
                  }}
                >
                  <Tooltip title={fireCards.includes(selectedCard.id) ? "Remover Foguinho" : "Adicionar Foguinho"}>
                    <IconButton
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleToggleFire(selectedCard.id);
                      }}
                      sx={{
                        color: fireCards.includes(selectedCard.id) ? '#ff4444' : 'white',
                        background: 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(10px)',
                        '&:hover': {
                          background: 'rgba(0, 0, 0, 0.7)',
                        },
                      }}
                    >
                      <LocalFireDepartmentIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </motion.div>
            )}
          </Box>
        </Fade>
      </Modal>

      {/* Card Container */}
      <Container 
        maxWidth="md" 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          py: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait">
          {currentCard && (
            <motion.div
              key={currentCard.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'absolute',
                width: '100%',
                maxWidth: isMobile ? '90%' : '500px',
                height: '100%',
              }}
            >
              <Card
                ref={cardRef}
                elevation={0}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 4,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'grab',
                  '&:active': {
                    cursor: 'grabbing',
                  },
                }}
                onMouseDown={handleDragStart}
                onMouseUp={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchEnd={handleDragEnd}
              >
                <Box sx={{ position: 'relative' }}>
                  <CardMedia
                    component="img"
                    sx={{
                      height: { xs: '250px', sm: '300px' },
                      objectFit: 'cover',
                      objectPosition: 'center center',
                      filter: 'brightness(0.8)',
                      width: '100%',
                    }}
                    image={currentCard.image}
                    alt={currentCard.title}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      zIndex: 2,
                      display: 'flex',
                      gap: 1,
                    }}
                  >
                    <Tooltip title={fireCards.includes(currentCard.id) ? "Remover Foguinho" : "Adicionar Foguinho"}>
                      <IconButton
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          handleToggleFire(currentCard.id);
                        }}
                        sx={{
                          color: fireCards.includes(currentCard.id) ? '#ff4444' : 'white',
                          background: 'rgba(0, 0, 0, 0.5)',
                          backdropFilter: 'blur(10px)',
                          '&:hover': {
                            background: 'rgba(0, 0, 0, 0.7)',
                          },
                        }}
                      >
                        <LocalFireDepartmentIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Typography variant="h5" sx={{ color: 'white', mb: 1 }}>
                    {currentCard.title}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
                    {currentCard.description}
                  </Typography>
                  <Chip
                    label={currentCard.category}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                    }}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>

      {/* Action Buttons */}
      <Paper
        elevation={0}
        sx={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: 0,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          padding: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Tooltip title="Voltar ao Dashboard">
          <IconButton
            onClick={() => navigate('/dashboard')}
            sx={{
              color: 'white',
              background: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Pular">
            <IconButton
              onClick={() => handleCardAction('skip')}
              sx={{
                color: 'white',
                background: 'rgba(255, 255, 255, 0.1)',
                width: 56,
                height: 56,
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.2)',
                  transform: 'scale(1.1)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Curtir">
            <IconButton
              onClick={() => handleCardAction('like')}
              sx={{
                color: 'white',
                background: 'rgba(255, 255, 255, 0.1)',
                width: 56,
                height: 56,
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.2)',
                  transform: 'scale(1.1)',
                },
              }}
            >
              <FavoriteIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ width: 40 }} /> {/* Espaçador para manter o layout centralizado */}
      </Paper>
      
      {/* Snackbar para notificações */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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

export default Game; 