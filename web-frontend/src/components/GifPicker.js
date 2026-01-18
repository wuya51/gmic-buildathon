import React, { useState, useEffect, useCallback } from 'react';

const GIPHY_API_KEY = 'u4nLzr0cJvlaK9d4DTe2xiAo3Nc38mV2';

const GifPicker = ({ onGifSelect, onClose }) => {
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('trending');

  const categories = [
    { id: 'trending', name: 'Trending' },
    { id: 'funny', name: 'Funny' },
    { id: 'reaction', name: 'Reaction' },
    { id: 'crypto', name: 'Crypto' },
    { id: 'meme', name: 'Meme' }
  ];

  const fetchGifs = useCallback(async (category = 'trending', query = '') => {
    setLoading(true);
    setError('');
    
    try {
      let url;
      if (query) {
        url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`;
      } else {
        url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch GIFs');
      }
      
      const data = await response.json();
      setGifs(data.data || []);
    } catch (err) {
      setError('Failed to load GIFs');

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeoutId = setTimeout(() => {
        fetchGifs('search', searchQuery);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      fetchGifs(activeCategory);
    }
  }, [searchQuery, activeCategory, fetchGifs]);

  const handleCategoryClick = (categoryId) => {
    setActiveCategory(categoryId);
    setSearchQuery('');
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleGifClick = (gif) => {
    const gifUrl = gif.images.fixed_height.url;
    onGifSelect(gifUrl);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm pointer-events-auto isolate animate-fadeIn" onClick={handleOverlayClick}>
      <div className="gif-picker-container bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] w-[90%] max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col animate-slideUp">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="text-lg font-semibold text-gray-800">Choose a GIF</div>
          <button className="bg-none border-none text-xl cursor-pointer text-gray-600 p-1.5 px-2 rounded-full transition-all duration-200 hover:bg-gray-200 hover:text-gray-800" onClick={onClose}>×</button>
        </div>
        
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search GIFs..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:ring-offset-1"
          />
        </div>
        
        <div className="p-3 border-b border-gray-200 flex gap-2 overflow-x-auto overflow-y-hidden flex-wrap">
          {categories.map(category => (
            <button
              key={category.id}
              className={`px-3 py-1.5 border border-gray-300 rounded-full bg-white text-sm font-normal cursor-pointer whitespace-nowrap transition-all duration-200 flex items-center justify-center h-[28px] ${activeCategory === category.id ? 'bg-blue-600 text-white border-blue-600 shadow-md hover:bg-blue-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              style={{ boxSizing: 'border-box' }}
              onClick={() => handleCategoryClick(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center p-10 text-gray-600">Loading GIFs...</div>
          ) : error ? (
            <div className="p-5 text-center text-red-600">{error}</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1.5">
              {gifs.map(gif => (
                <div
                  key={gif.id}
                  className="cursor-pointer rounded-lg overflow-hidden transition-transform duration-200 hover:scale-105"
                  onClick={() => handleGifClick(gif)}
                >
                  <img src={gif.images.fixed_height_small.url} alt={gif.title} className="w-full h-[70px] object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-3 border-t border-gray-200 text-center text-xs text-gray-600">
          Powered by GIPHY
        </div>
      </div>
    </div>
  );
};

export default GifPicker;