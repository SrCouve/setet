import { useState, useEffect } from 'react';
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
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
}

const Game = () => {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [matchedCards, setMatchedCards] = useState<string[]>([]);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [highlightedCards, setHighlightedCards] = useState<string[]>([]);
  const [hasNewMatch, setHasNewMatch] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Carregar cartas do Firebase e resetar o índice
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const currentUser = auth.currentUser;
        if (!currentUser || !partnerId) {
          console.error('Usuário não autenticado ou parceiro não especificado');
          return;
        }

        // Carregar informações do parceiro
        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
        if (!partnerDoc.exists()) {
          console.error('Parceiro não encontrado');
          setSnackbar({
            open: true,
            message: 'Parceiro não encontrado',
            severity: 'error',
          });
          return;
        }

        const partnerData = partnerDoc.data();
        setPartner({
          id: partnerId,
          name: partnerData.name || 'Parceiro',
          avatar: partnerData.avatar || '👤',
          online: true,
          likedCards: partnerData.likedCards || [],
        });

        // Carregar cartas
        const cardsCollection = collection(db, 'cards');
        const cardsSnapshot = await getDocs(cardsCollection);
        const cardsData = cardsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CardData[];
        setCards(cardsData);
        setCurrentCardIndex(0); // Resetar o índice quando carregar novas cartas
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setSnackbar({
          open: true,
          message: 'Erro ao carregar dados',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [partnerId]);

  // Motion values for drag
  const x = useMotionValue(0);
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const cardWidth = 200; // Largura de cada card
  const gap = 16; // Espaço entre os cards
  const leftLimit = cards.length > 1 ? -(cards.length - 1) * (cardWidth + gap) : 0;

  const rotate = useTransform(x, [leftLimit, 0], [25, 0]);
  const opacity = useTransform(x, [leftLimit / 2, 0], [0.5, 1]);

  const isMatch = (cardId: string) => {
    return partner?.likedCards.includes(cardId) || false;
  };

  const getMatches = () => {
    return cards.filter(card => isMatch(card.id));
  };

  const handleDragEnd = async (event: any, info: any) => {
    const threshold = 100;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (Math.abs(velocity) > 500 || Math.abs(offset) > threshold) {
      const direction = velocity > 0 || offset > 0 ? 'right' : 'left';
      setSwipeDirection(direction);

      if (direction === 'right' && currentCardIndex < cards.length - 1) {
        const currentCard = cards[currentCardIndex];
        
        // Verificar se é um match
        const isNewMatch = isMatch(currentCard.id);
        if (isNewMatch && !matchedCards.includes(currentCard.id)) {
          setMatchedCards([...matchedCards, currentCard.id]);
          setHasNewMatch(true);
          
          // Salvar no Firestore
          try {
            const currentUser = auth.currentUser;
            if (currentUser) {
              const userDoc = doc(db, 'users', currentUser.uid);
              await updateDoc(userDoc, {
                likedCards: arrayUnion(currentCard.id)
              });
            }
          } catch (error) {
            console.error('Erro ao salvar match:', error);
          }
        }
        
        setCurrentCardIndex(currentCardIndex + 1);
      } else if (direction === 'left' && currentCardIndex > 0) {
        setCurrentCardIndex(currentCardIndex - 1);
      }
    }

    setSwipeDirection(null);
  };

  const toggleHighlight = async (cardId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userDoc = doc(db, 'users', currentUser.uid);
      const userData = (await getDoc(userDoc)).data();
      const currentLikedCards = userData?.likedCards || [];
      
      if (highlightedCards.includes(cardId)) {
        setHighlightedCards(highlightedCards.filter(id => id !== cardId));
        await updateDoc(userDoc, {
          likedCards: arrayRemove(cardId)
        });
      } else {
        setHighlightedCards([...highlightedCards, cardId]);
        await updateDoc(userDoc, {
          likedCards: arrayUnion(cardId)
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar destaque:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao atualizar destaque',
        severity: 'error',
      });
    }
  };

  const handleShowMatches = () => {
    setShowMatches(!showMatches);
    if (hasNewMatch) {
      setHasNewMatch(false);
    }
  };

  const currentCard = cards[currentCardIndex];

  if (!currentCard) {
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
        <Typography variant="h4" gutterBottom>
          Acabaram as cartas!
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setCurrentCardIndex(0)}
          sx={{ mt: 2 }}
        >
          Recomeçar
        </Button>
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: 'transparent', fontSize: '1.5rem' }}>
            {partner?.avatar}
          </Avatar>
          <Typography variant="h6" sx={{ color: 'white' }}>
            {partner?.name || 'Parceiro'}
          </Typography>
        </Box>

        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={handleShowMatches}
            sx={{ color: 'white' }}
          >
            {showMatches ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
          </IconButton>
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
          <motion.div 
            drag="x"
            dragConstraints={{ 
              right: 0, 
              left: getMatches().length <= 1 ? 0 : -((getMatches().length - 1) * 216)
            }}
            dragElastic={0.1}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
            style={{
              display: 'flex',
              gap: '16px',
              cursor: 'grab',
              width: '100%',
              paddingBottom: '8px',
              touchAction: 'pan-x',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
            whileTap={{ cursor: 'grabbing' }}
          >
            <Box 
              sx={{ 
                display: 'flex',
                gap: 2,
                height: '200px',
                '& > *': {
                  flexShrink: 0,
                },
                '& img': {
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitUserDrag: 'none',
                  WebkitTouchCallout: 'none',
                  pointerEvents: 'none',
                },
              }}
            >
              {getMatches().map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setSelectedCard(card)}
                  style={{
                    scrollSnapAlign: 'start',
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      position: 'relative',
                      overflow: 'hidden',
                      aspectRatio: '1',
                      width: { xs: '200px', sm: '100%' },
                      flexShrink: { xs: 0, sm: 'unset' },
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 2,
                      cursor: 'pointer',
                      '&:hover': {
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        '& .match-overlay': {
                          opacity: 1,
                        },
                      },
                    }}
                  >
                    <Box sx={{ position: 'relative', width: '100%', height: '100%', userSelect: 'none' }}>
                      <CardMedia
                        component="img"
                        sx={{
                          height: { xs: '250px', sm: '300px' },
                          objectFit: 'cover',
                          objectPosition: 'center center',
                          filter: 'brightness(0.7)',
                          width: '100%',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          WebkitUserDrag: 'none',
                          WebkitTouchCallout: 'none',
                          pointerEvents: 'none',
                        }}
                        image={card.image}
                        alt={card.title}
                      />
                      <IconButton
                        onClick={() => toggleHighlight(card.id)}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          color: highlightedCards.includes(card.id) ? '#ff4444' : 'rgba(255, 255, 255, 0.5)',
                          background: 'rgba(0, 0, 0, 0.3)',
                          backdropFilter: 'blur(4px)',
                          '&:hover': {
                            background: 'rgba(0, 0, 0, 0.4)',
                          },
                          zIndex: 2,
                        }}
                      >
                        <LocalFireDepartmentIcon />
                      </IconButton>
                    </Box>
                    <Box
                      className="match-overlay"
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
                        p: 1.5,
                        opacity: 0.8,
                        transition: 'opacity 0.3s ease',
                        userSelect: 'none',
                        pointerEvents: 'none',
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: 'white',
                          fontWeight: 500,
                          fontSize: '0.8rem',
                          textAlign: 'center',
                          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        }}
                      >
                        {card.title}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        gap: 1,
                      }}
                    >
                      {highlightedCards.includes(card.id) && (
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <LocalFireDepartmentIcon sx={{ fontSize: 14, color: '#ff4444' }} />
                        </Box>
                      )}
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(5px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 14, color: 'white' }} />
                      </Box>
                    </Box>
                  </Paper>
                </motion.div>
              ))}
              {getMatches().length === 0 && (
                <Box
                  sx={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    p: 4,
                  }}
                >
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      textAlign: 'center',
                    }}
                  >
                    Ainda não há matches.
                    <br />
                    Continue jogando para descobrir afinidades!
                  </Typography>
                </Box>
              )}
            </Box>
          </motion.div>
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
              bgcolor: '#000000',
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
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Typography
                    component="h3"
                    sx={{
                      color: 'white',
                      fontWeight: 700,
                      mb: 2,
                      background: 'linear-gradient(90deg, #fff, rgba(255,255,255,0.8))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontSize: { xs: '2rem', sm: '2.5rem' },
                      letterSpacing: '0.02em',
                    }}
                  >
                    {selectedCard.title}
                  </Typography>
                  <Chip
                    label={selectedCard.category}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      fontSize: '0.9rem',
                      px: 2,
                      height: 32,
                    }}
                  />
                </Box>

                <div 
                  style={{ 
                    position: 'relative',
                    textAlign: 'center',
                    maxWidth: '500px',
                    margin: '0 auto',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -20,
                      left: -10,
                      fontSize: '4rem',
                      color: 'rgba(255, 255, 255, 0.1)',
                      fontFamily: 'serif',
                      content: '"""',
                    }}
                  >
                    "
                  </div>
                  <p
                    style={{
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '1.25rem',
                      lineHeight: '1.8',
                      letterSpacing: '0.02em',
                      fontWeight: 300,
                      padding: '16px 32px',
                      fontStyle: 'italic',
                      margin: 0,
                    }}
                  >
                    {selectedCard.description}
                  </p>
                </div>

                <Box sx={{ mt: 5, display: 'flex', justifyContent: 'center' }}>
                  <IconButton
                    onClick={() => setSelectedCard(null)}
                    sx={{
                      color: 'white',
                      background: 'rgba(255, 255, 255, 0.1)',
                      width: 48,
                      height: 48,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.2)',
                        transform: 'scale(1.1)',
                      },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 24 }} />
                  </IconButton>
                </Box>
              </motion.div>
            )}
          </Box>
        </Fade>
      </Modal>

      {/* Card Container */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: { xs: 1, sm: 2 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence>
          {currentCard && (
            <motion.div
              key={currentCard.id}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                x,
                rotate,
                opacity,
              }}
              drag="x"
              dragConstraints={{ left: leftLimit, right: 0 }}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              whileTap={{ cursor: 'grabbing' }}
            >
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 4,
                  boxShadow: 3,
                  '&:hover': {
                    transform: 'scale(1.02)',
                    transition: 'transform 0.2s ease-in-out',
                  },
                }}
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
                  <IconButton
                    onClick={() => toggleHighlight(currentCard.id)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      color: highlightedCards.includes(currentCard.id) ? '#ff4444' : 'rgba(255, 255, 255, 0.5)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      backdropFilter: 'blur(4px)',
                      '&:hover': {
                        background: 'rgba(0, 0, 0, 0.4)',
                      },
                      zIndex: 2,
                    }}
                  >
                    <LocalFireDepartmentIcon />
                  </IconButton>
                </Box>
                <CardContent 
                  sx={{ 
                    color: 'white',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    p: { xs: 2, sm: 3 },
                  }}
                >
                  <Box>
                    <Typography 
                      variant="h5" 
                      gutterBottom
                      sx={{
                        fontSize: { xs: '1.25rem', sm: '1.5rem' },
                        fontWeight: 600,
                      }}
                    >
                      {currentCard.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ 
                        mb: 2,
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                        lineHeight: 1.6,
                      }}
                    >
                      {currentCard.description}
                    </Typography>
                  </Box>
                  <Chip
                    label={currentCard.category}
                    size="small"
                    sx={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      alignSelf: 'flex-start',
                    }}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Bottom Buttons */}
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

        <Box sx={{ display: 'flex', gap: 4 }}>
          <IconButton
            onClick={() => {
              setSwipeDirection('left');
              setTimeout(() => {
                setCurrentCardIndex((prev) => prev + 1);
                setSwipeDirection(null);
              }, 300);
            }}
            sx={{
              color: 'white',
              background: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
          <IconButton
            onClick={() => {
              setSwipeDirection('right');
              setMatchedCards([...matchedCards, currentCard.id]);
              setTimeout(() => {
                setCurrentCardIndex((prev) => prev + 1);
                setSwipeDirection(null);
              }, 300);
            }}
            sx={{
              color: 'white',
              background: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            <FavoriteIcon />
          </IconButton>
        </Box>

        <Box sx={{ width: 40 }} /> {/* Espaçador para manter o layout centralizado */}
      </Paper>
    </Box>
  );
};

export default Game; 