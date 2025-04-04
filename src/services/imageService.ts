import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '../firebase';

export const uploadImage = async (file: File, path: string = 'avatars'): Promise<string> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const timestamp = Date.now();
    const fileName = `${user.uid}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, `${path}/${fileName}`);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    throw error;
  }
};

// Função para gerar uma URL de imagem padrão
export const getDefaultImageUrl = (category: string): string => {
  const defaultImages = {
    'Romântico': 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    'Fantasias': 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    'Relaxamento': 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    'Diversão': 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    'Exploração': 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    'Novo': 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  };

  return defaultImages[category as keyof typeof defaultImages] || defaultImages['Novo'];
}; 