export const BUTTON_STYLES = {
  primary: 'bg-gradient-to-r from-[#ff2a00] to-[#cc2100] text-white hover:from-[#cc2100] hover:to-[#ff2a00]',
  secondary: 'bg-blue-600 text-white hover:bg-blue-700',
  outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50'
};

export const CARD_STYLES = {
  base: 'bg-white rounded-lg shadow-md border border-gray-200',
  hover: 'hover:shadow-lg transition-shadow duration-300'
};

export const TEXT_STYLES = {
  title: 'text-xl font-semibold text-gray-800',
  subtitle: 'text-lg font-medium text-gray-600',
  body: 'text-base text-gray-700'
};

export const INPUT_STYLES = {
  base: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#ff2a00] focus:border-transparent',
  error: 'border-red-500 focus:ring-red-500'
};

export const BADGE_STYLES = {
  primary: 'bg-[#ff2a00] text-white px-2 py-1 rounded text-xs',
  secondary: 'bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs'
};

export const MODAL_STYLES = {
  overlay: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
  content: 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4'
};

export const NOTIFICATION_STYLES = {
  success: 'bg-green-100 border-green-400 text-green-800',
  error: 'bg-red-100 border-red-400 text-red-800',
  info: 'bg-blue-100 border-blue-400 text-blue-800',
  warning: 'bg-yellow-100 border-yellow-400 text-yellow-800'
};

export const NAVIGATION_STYLES = {
  tab: 'px-2 py-1.5 font-medium text-base transition-all duration-200 relative bg-transparent border-none cursor-pointer whitespace-nowrap',
  active: 'text-[#ff2a00] after:absolute after:bottom-[-2px] after:left-1/2 after:-translate-x-1/2 after:w-1/2 after:h-0.5 after:bg-[#ff2a00]',
  inactive: 'text-white hover:text-[#ff2a00]'
};

export const HEADER_STYLES = {
  base: 'sticky top-0 z-1000 bg-[#122345] text-white shadow-md',
  container: 'max-w-[800px] w-full mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4'
};

export const CHAT_STYLES = {
  input: 'w-full py-3 px-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff2a00] focus:border-transparent resize-none transition-all duration-300 flex items-center',
  button: 'relative bg-[#ff2a00] text-white border-none text-xs font-semibold p-2 px-4 rounded-md transition-all duration-300 hover:bg-[#ff4d2e] hover:scale-105 hover:shadow-md hover:shadow-[rgba(255,42,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed'
};