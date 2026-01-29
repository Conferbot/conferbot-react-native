/**
 * Knowledge Base Components for Conferbot React Native SDK
 *
 * A complete set of UI components for displaying and interacting
 * with Knowledge Base articles in mobile applications.
 *
 * @example
 * ```tsx
 * import {
 *   KnowledgeBaseScreen,
 *   ChatWidgetWithKB,
 *   KBButton,
 *   ArticleCard,
 *   SearchBar,
 * } from 'conferbot-react-native';
 *
 * // Full screen usage
 * <KnowledgeBaseScreen
 *   categories={kbCategories}
 *   onClose={() => navigation.goBack()}
 * />
 *
 * // Chat widget with integrated KB tabs
 * <ChatWidgetWithKB
 *   visible={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   enableKnowledgeBase={true}
 *   kbCategories={categories}
 *   kbIntegration="tab"
 * />
 *
 * // Add KB button to chat header
 * <ChatHeader
 *   rightActions={<KBButton onPress={openKB} />}
 * />
 *
 * // Individual components
 * <SearchBar
 *   onSearch={handleSearch}
 *   placeholder="Find help..."
 * />
 * ```
 */

// Main screen component
export { KnowledgeBaseScreen } from './KnowledgeBaseScreen';
export type { KnowledgeBaseScreenProps } from './KnowledgeBaseScreen';

// Integrated chat widget with KB
export { ChatWidgetWithKB } from './ChatWidgetWithKB';
export type { ChatWidgetWithKBProps } from './ChatWidgetWithKB';

// Context and hooks
export { KBProvider, useKB } from './KBContext';

// Individual components
export { KBButton } from './KBButton';
export type { KBButtonProps } from './KBButton';

export { SearchBar } from './SearchBar';
export type { SearchBarProps } from './SearchBar';

export { CategoryFilter } from './CategoryFilter';
export type { CategoryFilterProps } from './CategoryFilter';

export { ArticleCard } from './ArticleCard';
export type { ArticleCardProps } from './ArticleCard';

export { ArticleList } from './ArticleList';
export type { ArticleListProps } from './ArticleList';

export { ArticleDetail } from './ArticleDetail';
export type { ArticleDetailProps } from './ArticleDetail';

export { ArticleRating } from './ArticleRating';
export type { ArticleRatingProps } from './ArticleRating';

// Types
export type {
  KBArticle,
  KBCategory,
  KBCategoryWithArticles,
  KBAuthor,
  KBState,
  KBScreenType,
  KBStyleProps,
  ArticleViewPayload,
  ArticleEngagementPayload,
  ArticleRatingPayload,
} from './types';
