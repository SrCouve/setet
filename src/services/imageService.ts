// Serviço para upload de imagens usando ImgBB
const IMGBB_API_KEY = 'b9898541a32ed4f20c7b29ada1cb6d00'; // Substitua pela sua chave API do ImgBB

export const uploadImage = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error('Falha no upload da imagem');
    }

    return data.data.url;
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