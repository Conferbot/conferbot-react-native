/**
 * Core Utilities Index
 *
 * Central export point for core utility modules in the Conferbot React Native SDK.
 */

// ========================================
// VALIDATION UTILITIES
// ========================================

export {
  validateEmail,
  validatePhone,
  validateName,
  validateNumber,
  validateUrl,
  validateDate,
  validateAddress,
  validateFile,
  validateLocation,
  validate,
  validateByType,
} from './ValidationUtils';

export type { ValidationResult } from './ValidationUtils';

// ========================================
// INTEGRATION UTILITIES
// ========================================

export {
  // Email utilities
  validateEmailList,
  formatEmailBody,
  validateEmailConfig,

  // Slack utilities
  formatSlackMessage,
  createSlackBlock,
  createSlackAttachment,

  // Discord utilities
  formatDiscordMessage,
  createDiscordEmbed,

  // CRM utilities
  formatHubSpotContact,
  formatZohoCRMRecord,
  formatSalesforceRecord,

  // Airtable utilities
  formatAirtableFields,

  // Notion utilities
  createNotionProperty,
  createNotionBlock,
  formatNotionProperties,

  // Google Sheets utilities
  formatGoogleSheetsRow,

  // Stripe utilities
  formatStripeAmount,
  formatStripeMetadata,

  // Common utilities
  formatFieldName,
  extractContactData,
  removeEmptyValues,
  deepResolveVariables,
  buildBasePayload,
  safeJsonParse,
  validateWebhookUrl,
} from './IntegrationUtils';

// ========================================
// INTEGRATION TYPES
// ========================================

export type {
  // HTTP types
  HttpMethod,
  ApiResponse,
  AuthenticationType,
  WebhookAuthentication,

  // Socket types
  SocketClient,

  // Result types
  IntegrationStatus,
  IntegrationResult,

  // Config types
  WebhookConfig,
  EmailConfig,
  EmailPayload,
  EmailAttachment,

  // Communication types
  CommunicationConfig,
  SlackConfig,
  SlackBlock,
  SlackAttachment,
  DiscordConfig,
  DiscordEmbed,

  // Google types
  GoogleSheetsAction,
  GoogleSheetsConfig,
  GoogleSheetsPayload,
  GoogleCalendarAction,
  CalendarEvent,
  GoogleCalendarConfig,
  GmailConfig,
  GoogleAnalyticsConfig,

  // CRM types
  CRMAction,
  ContactData,
  HubSpotConfig,
  HubSpotPayload,
  SalesforceConfig,
  ZohoCRMModule,
  ZohoCRMConfig,
  ZohoCRMPayload,
  MailchimpConfig,

  // Automation types
  ZapierConfig,
  AirtableAction,
  AirtableConfig,
  AirtablePayload,
  NotionAction,
  NotionConfig,
  NotionProperty,
  NotionBlock,
  NotionPayload,

  // Payment types
  StripeAction,
  StripeConfig,
  StripePayload,

  // Base types
  BaseIntegrationPayload,
  IntegrationSocketEvent,
} from './IntegrationTypes';

export { IntegrationSocketEvents } from './IntegrationTypes';
