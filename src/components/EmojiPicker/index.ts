// EmojiPicker module exports
export { EmojiPicker } from './EmojiPicker';
export type { EmojiPickerProps } from './EmojiPicker';

export { EmojiButton } from './EmojiButton';
export type { EmojiButtonProps } from './EmojiButton';

export { EmojiCategory } from './EmojiCategory';
export type { EmojiCategoryProps } from './EmojiCategory';

export { EmojiGrid } from './EmojiGrid';
export type { EmojiGridProps } from './EmojiGrid';

export { EmojiSearchBar } from './EmojiSearchBar';
export type { EmojiSearchBarProps } from './EmojiSearchBar';

export { SkinToneSelector } from './SkinToneSelector';
export type { SkinToneSelectorProps } from './SkinToneSelector';

// Emoji data exports
export {
  EMOJI_CATEGORIES,
  SKIN_TONES,
  SKIN_TONE_SUPPORTED_EMOJIS,
  EMOJI_KEYWORDS,
  searchEmojis,
  applySkintone,
  RECENT_EMOJIS_STORAGE_KEY,
  MAX_RECENT_EMOJIS,
} from './emojiData';

export type { EmojiCategory as EmojiCategoryData, SkinToneId } from './emojiData';
