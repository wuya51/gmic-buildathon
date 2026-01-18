import React from 'react';

const EmojiPicker = ({ onEmojiSelect, onClose }) => {
  const emojiCategories = [
    {
      title: 'Frequently Used',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐']
    },
    {
      title: 'Gestures',
      emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🙏', '👏', '👐', '🤲', '🙌']
    },
    {
      title: 'Crypto & Tech',
      emojis: ['🚀', '💰', '💎', '🔥', '🌙', '⭐', '✨', '💫', '🌟', '💯', '🔮', '💻', '📱', '⚡', '🔧', '⚙️', '🛠️', '🔗', '📊', '📈', '📉', '💹', '🏦', '💳', '💵', '💴', '💶', '💷', '🪙']
    }
  ];

  const handleEmojiClick = (emoji) => {
    onEmojiSelect(emoji);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] animate-fadeIn backdrop-blur-sm pointer-events-auto isolate" onClick={onClose}>
      <div className="emoji-picker-container bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] max-w-[400px] max-h-[500px] w-[90vw] overflow-hidden animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="m-0 text-sm font-semibold text-gray-700">Select Emoji</h3>
          <button className="bg-none border-none text-2xl cursor-pointer text-gray-500 p-1 rounded-md transition-all duration-200 hover:bg-gray-200 hover:text-gray-700" onClick={onClose} title="Close">
            ×
          </button>
        </div>
        
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {emojiCategories.map((category, index) => (
            <div key={index} className="mb-5 last:mb-0">
              <span className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">{category.title}</span>
              <div className="grid grid-cols-8 gap-1 sm:grid-cols-6">
                {category.emojis.map((emoji, emojiIndex) => (
                  <span 
                    key={emojiIndex} 
                    className="flex items-center justify-center text-xl cursor-pointer p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 hover:scale-110 active:scale-95 select-none"
                    onClick={() => handleEmojiClick(emoji)}
                    title={emoji}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;