/**
 * IntegrationTypes.ts
 *
 * Shared TypeScript interfaces for integration handlers in the Conferbot React Native SDK.
 * Provides type definitions for all integration configurations, payloads, and responses.
 */

// ========================================
// HTTP AND API TYPES
// ========================================

/** HTTP method types for webhook and API calls */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** API call response structure */
export interface ApiResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data on success */
  data?: T;
  /** Error message on failure */
  error?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Number of retry attempts made */
  retryCount?: number;
}

/** Authentication types for webhooks */
export type AuthenticationType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

/** Webhook authentication configuration */
export interface WebhookAuthentication {
  type: AuthenticationType;
  /** Bearer token for bearer auth */
  token?: string;
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
  /** API key name */
  apiKeyName?: string;
  /** API key value */
  apiKeyValue?: string;
  /** API key location: header or query */
  apiKeyLocation?: 'header' | 'query';
  /** OAuth2 token URL */
  tokenUrl?: string;
  /** OAuth2 client ID */
  clientId?: string;
  /** OAuth2 client secret */
  clientSecret?: string;
  /** OAuth2 scope */
  scope?: string;
}

// ========================================
// SOCKET CLIENT INTERFACE
// ========================================

/** Socket client interface for real-time communication */
export interface SocketClient {
  /** Emit an event to the server (sends via socket.io connection) */
  emitToServer(event: string, payload: unknown): void;
  /** Listen for an event */
  on?(event: string, callback: (data: unknown) => void): void;
  /** Remove event listener */
  off?(event: string, callback?: (data: unknown) => void): void;
  /** Check if socket is connected */
  connected?: boolean;
}

// ========================================
// INTEGRATION RESULT TYPES
// ========================================

/** Result status for integration operations */
export type IntegrationStatus = 'pending' | 'success' | 'error' | 'timeout' | 'cancelled';

/** Integration execution result */
export interface IntegrationResult<T = unknown> {
  /** Status of the integration operation */
  status: IntegrationStatus;
  /** Response data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Timestamp of completion */
  timestamp: string;
  /** Number of retry attempts */
  retryCount?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ========================================
// WEBHOOK CONFIGURATION
// ========================================

/** Webhook node configuration */
export interface WebhookConfig {
  /** Webhook URL (required) */
  url: string;
  /** HTTP method (default: POST) */
  method: HttpMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Variable name to store response */
  variableName?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retryCount?: number;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
  /** Authentication configuration */
  authentication?: WebhookAuthentication;
  /** Whether to include answer variables in body */
  includeAnswerVariables?: boolean;
}

// ========================================
// EMAIL CONFIGURATION
// ========================================

/** Email attachment structure */
export interface EmailAttachment {
  /** File name */
  name: string;
  /** File URL or base64 content */
  url: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
}

/** Email node configuration */
export interface EmailConfig {
  /** Recipient email address (required) */
  to: string;
  /** Email subject */
  subject: string;
  /** Email body content */
  body: string;
  /** CC recipients */
  cc?: string;
  /** BCC recipients */
  bcc?: string;
  /** Reply-to address */
  replyTo?: string;
  /** Email attachments */
  attachments?: EmailAttachment[];
  /** Email format: text or html */
  format?: 'text' | 'html';
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Email payload sent to server */
export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  format?: 'text' | 'html';
  sessionId: string;
  botId: string;
  timestamp: string;
  nodeId: string;
  userMetadata?: Record<string, unknown>;
}

// ========================================
// COMMUNICATION PLATFORM CONFIGS
// ========================================

/** Base configuration for communication platforms */
export interface CommunicationConfig {
  /** Message content (required) */
  message: string;
  /** Channel/room identifier */
  channel?: string;
  /** Webhook URL for direct posting */
  webhookUrl?: string;
  /** Additional platform-specific data */
  additionalData?: Record<string, unknown>;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Slack-specific configuration */
export interface SlackConfig extends CommunicationConfig {
  /** Slack channel name or ID */
  channel?: string;
  /** Bot username to display */
  username?: string;
  /** Bot icon emoji or URL */
  icon?: string;
  /** Message blocks for rich formatting */
  blocks?: SlackBlock[];
  /** Message attachments */
  attachments?: SlackAttachment[];
  /** Thread timestamp to reply to */
  threadTs?: string;
}

/** Slack block structure */
export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
  };
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
  }>;
  accessory?: unknown;
  elements?: unknown[];
}

/** Slack attachment structure */
export interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  ts?: number;
}

/** Discord-specific configuration */
export interface DiscordConfig extends CommunicationConfig {
  /** Discord channel ID */
  channelId?: string;
  /** Bot username to display */
  username?: string;
  /** Bot avatar URL */
  avatarUrl?: string;
  /** Message embeds */
  embeds?: DiscordEmbed[];
  /** Text-to-speech flag */
  tts?: boolean;
}

/** Discord embed structure */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

// ========================================
// GOOGLE INTEGRATIONS
// ========================================

/** Google Sheets action types */
export type GoogleSheetsAction = 'addRow' | 'updateRow' | 'getRow' | 'getRows';

/** Google Sheets configuration */
export interface GoogleSheetsConfig {
  /** Spreadsheet ID (required) */
  spreadsheetId: string;
  /** Sheet name (default: first sheet) */
  sheetName?: string;
  /** Action to perform */
  action: GoogleSheetsAction;
  /** Data to write */
  data?: Record<string, unknown>;
  /** Column mappings for structured data */
  columnMappings?: Array<{
    column: string;
    value: string;
  }>;
  /** Row ID for update operations */
  rowId?: string | number;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Google Sheets payload */
export interface GoogleSheetsPayload {
  spreadsheetId: string;
  sheetName?: string;
  action: GoogleSheetsAction;
  data: Record<string, unknown>;
  columnMappings?: Array<{
    column: string;
    value: string;
  }>;
  rowId?: string | number;
  sessionId: string;
  botId: string;
  timestamp: string;
  nodeId: string;
}

/** Google Calendar action types */
export type GoogleCalendarAction = 'createEvent' | 'checkAvailability' | 'getEvents' | 'bookSlot';

/** Google Calendar event structure */
export interface CalendarEvent {
  /** Event title */
  title: string;
  /** Event description */
  description?: string;
  /** Start time (ISO string) */
  startTime: string;
  /** End time (ISO string) */
  endTime: string;
  /** Attendee email addresses */
  attendees?: string[];
  /** Event location */
  location?: string;
  /** Timezone */
  timezone?: string;
  /** Meeting link (for Google Meet) */
  meetingLink?: string;
}

/** Google Calendar configuration */
export interface GoogleCalendarConfig {
  /** Calendar ID (default: primary) */
  calendarId?: string;
  /** Action to perform */
  action: GoogleCalendarAction;
  /** Event data for create operations */
  event?: CalendarEvent;
  /** Start date for availability check */
  startDate?: string;
  /** End date for availability check */
  endDate?: string;
  /** Timezone for display */
  timezone?: string;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Gmail configuration */
export interface GmailConfig extends EmailConfig {
  /** Gmail-specific: send as draft */
  saveAsDraft?: boolean;
  /** Gmail labels to apply */
  labels?: string[];
}

/** Google Analytics configuration */
export interface GoogleAnalyticsConfig {
  /** Tracking/Measurement ID */
  trackingId?: string;
  /** Event category */
  eventCategory: string;
  /** Event action */
  eventAction: string;
  /** Event label */
  eventLabel?: string;
  /** Event value */
  eventValue?: number;
  /** Custom dimensions */
  customDimensions?: Record<string, string>;
  /** Custom metrics */
  customMetrics?: Record<string, number>;
}

// ========================================
// CRM INTEGRATIONS
// ========================================

/** CRM action types */
export type CRMAction =
  | 'createContact'
  | 'updateContact'
  | 'createLead'
  | 'createDeal'
  | 'addToList'
  | 'subscribe';

/** Contact data structure for CRMs */
export interface ContactData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  source?: string;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  /** Index signature for additional dynamic fields */
  [key: string]: unknown;
}

/** HubSpot configuration */
export interface HubSpotConfig {
  /** Action to perform */
  action: CRMAction;
  /** Contact data */
  contactData?: ContactData;
  /** List ID for addToList action */
  listId?: string;
  /** Deal data for createDeal action */
  dealData?: {
    name: string;
    amount?: number;
    stage?: string;
    pipeline?: string;
    closeDate?: string;
  };
  /** Lead status */
  leadStatus?: string;
  /** Lifecycle stage */
  lifecycleStage?: string;
  /** Webhook URL for custom integration */
  webhookUrl?: string;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** HubSpot payload structure */
export interface HubSpotPayload {
  action: CRMAction;
  properties: Record<string, unknown>;
  associations?: Array<{
    type: string;
    id: string;
  }>;
  listId?: string;
  sessionId: string;
  botId: string;
  timestamp: string;
  nodeId: string;
}

/** Salesforce configuration */
export interface SalesforceConfig {
  /** Action to perform */
  action: CRMAction;
  /** Object type: Contact, Lead, Account, Opportunity */
  objectType?: string;
  /** Contact/Lead data */
  contactData?: ContactData;
  /** Record ID for updates */
  recordId?: string;
  /** Campaign ID for campaign membership */
  campaignId?: string;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Zoho CRM module types */
export type ZohoCRMModule = 'Contacts' | 'Leads' | 'Accounts' | 'Deals' | 'Tasks' | 'Custom';

/** Zoho CRM configuration */
export interface ZohoCRMConfig {
  /** Module to operate on */
  module: ZohoCRMModule;
  /** Action to perform */
  action: 'create' | 'update' | 'search';
  /** Record data */
  data?: Record<string, unknown>;
  /** Record ID for updates */
  recordId?: string;
  /** Search criteria */
  searchCriteria?: string;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Zoho CRM payload structure */
export interface ZohoCRMPayload {
  module: ZohoCRMModule;
  action: string;
  data: Array<Record<string, unknown>>;
  recordId?: string;
  sessionId: string;
  botId: string;
  timestamp: string;
  nodeId: string;
}

/** Mailchimp configuration */
export interface MailchimpConfig {
  /** Action: subscribe, unsubscribe, update */
  action: 'subscribe' | 'unsubscribe' | 'update';
  /** List/Audience ID (required) */
  listId: string;
  /** Subscriber email (required) */
  email: string;
  /** Subscriber status */
  status?: 'subscribed' | 'pending' | 'unsubscribed';
  /** Merge fields (FNAME, LNAME, etc.) */
  mergeFields?: Record<string, string>;
  /** Tags to apply */
  tags?: string[];
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

// ========================================
// AUTOMATION INTEGRATIONS
// ========================================

/** Zapier configuration */
export interface ZapierConfig {
  /** Webhook URL (required) */
  webhookUrl: string;
  /** Data to send */
  data?: Record<string, unknown>;
  /** Include all answer variables */
  includeAllAnswers?: boolean;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Airtable action types */
export type AirtableAction = 'createRecord' | 'updateRecord' | 'getRecord' | 'listRecords';

/** Airtable configuration */
export interface AirtableConfig {
  /** Base ID (required) */
  baseId: string;
  /** Table name (required) */
  tableName: string;
  /** Action to perform */
  action: AirtableAction;
  /** Record ID for update/get operations */
  recordId?: string;
  /** Field values */
  fields?: Record<string, unknown>;
  /** Filter formula for list operations */
  filterFormula?: string;
  /** Max records for list operations */
  maxRecords?: number;
  /** Sort configuration */
  sort?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Airtable payload structure */
export interface AirtablePayload {
  baseId: string;
  tableName: string;
  action: AirtableAction;
  recordId?: string;
  fields: Record<string, unknown>;
  filterFormula?: string;
  maxRecords?: number;
  sort?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  sessionId: string;
  botId: string;
  timestamp: string;
  nodeId: string;
}

/** Notion action types */
export type NotionAction = 'createPage' | 'updatePage' | 'addToDatabase' | 'queryDatabase';

/** Notion configuration - uses flexible property type for both input and formatted output */
export interface NotionConfig {
  /** Database ID for database operations */
  databaseId?: string;
  /** Parent page ID for page creation */
  parentPageId?: string;
  /** Action to perform */
  action: NotionAction;
  /** Page/database properties - accepts raw data or formatted Notion properties */
  properties?: Record<string, unknown>;
  /** Page content blocks */
  content?: NotionBlock[];
  /** Filter for queries */
  filter?: Record<string, unknown>;
  /** Sort configuration */
  sorts?: Array<{
    property: string;
    direction: 'ascending' | 'descending';
  }>;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Notion property types for formatted properties */
export type NotionProperty =
  | { type: 'title'; title: string }
  | { type: 'rich_text'; text: string }
  | { type: 'number'; number: number }
  | { type: 'select'; select: string }
  | { type: 'multi_select'; multi_select: string[] }
  | { type: 'date'; date: string }
  | { type: 'checkbox'; checkbox: boolean }
  | { type: 'url'; url: string }
  | { type: 'email'; email: string }
  | { type: 'phone_number'; phone_number: string };

/** Notion block types */
export interface NotionBlock {
  type: 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'divider';
  text?: string;
  checked?: boolean;
}

/** Notion payload structure */
export interface NotionPayload {
  action: NotionAction;
  databaseId?: string;
  parentPageId?: string;
  properties: Record<string, unknown>;
  children?: NotionBlock[];
  filter?: Record<string, unknown>;
  sorts?: Array<{
    property: string;
    direction: 'ascending' | 'descending';
  }>;
  sessionId: string;
  botId: string;
  timestamp: string;
  nodeId: string;
}

// ========================================
// PAYMENT INTEGRATIONS
// ========================================

/** Stripe action types */
export type StripeAction =
  | 'createPaymentLink'
  | 'createCheckoutSession'
  | 'createCustomer'
  | 'createSubscription';

/** Stripe configuration */
export interface StripeConfig {
  /** Action to perform */
  action: StripeAction;
  /** Amount in cents */
  amount?: number;
  /** Currency code (default: USD) */
  currency?: string;
  /** Product/item description */
  description?: string;
  /** Product name */
  productName?: string;
  /** Customer email */
  customerEmail?: string;
  /** Success redirect URL */
  successUrl?: string;
  /** Cancel redirect URL */
  cancelUrl?: string;
  /** Price ID for subscriptions */
  priceId?: string;
  /** Metadata for the payment */
  metadata?: Record<string, string>;
  /** Variable name to store response */
  variableName?: string;
  /** Whether to proceed on error */
  proceedOnError?: boolean;
}

/** Stripe payload structure */
export interface StripePayload {
  action: StripeAction;
  amount?: number;
  currency: string;
  description?: string;
  productName?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
  priceId?: string;
  metadata?: Record<string, string>;
  sessionId: string;
  botId: string;
  timestamp: string;
  nodeId: string;
  answers: Record<string, unknown>;
}

// ========================================
// COMMON PAYLOAD STRUCTURE
// ========================================

/** Base payload structure for all integrations */
export interface BaseIntegrationPayload {
  /** Chat session ID */
  sessionId: string;
  /** Bot ID */
  botId: string;
  /** Timestamp of the request */
  timestamp: string;
  /** Node ID triggering the integration */
  nodeId: string;
  /** User metadata */
  userMetadata?: Record<string, unknown>;
  /** All collected answers */
  answers?: Record<string, unknown>;
}

/** Integration socket events */
export const IntegrationSocketEvents = {
  // Email
  EMAIL_SEND: 'email:send',
  EMAIL_SUCCESS: 'email:success',
  EMAIL_ERROR: 'email:error',

  // Zapier
  ZAPIER_TRIGGER: 'zapier:trigger',
  ZAPIER_SUCCESS: 'zapier:success',
  ZAPIER_ERROR: 'zapier:error',

  // Google
  GOOGLE_SHEETS_EXECUTE: 'googleSheets:execute',
  GOOGLE_SHEETS_SUCCESS: 'googleSheets:success',
  GOOGLE_SHEETS_ERROR: 'googleSheets:error',
  GOOGLE_CALENDAR_EXECUTE: 'googleCalendar:execute',
  GOOGLE_CALENDAR_SUCCESS: 'googleCalendar:success',
  GOOGLE_CALENDAR_ERROR: 'googleCalendar:error',
  GMAIL_SEND: 'gmail:send',
  GMAIL_SUCCESS: 'gmail:success',
  GMAIL_ERROR: 'gmail:error',

  // Communication
  SLACK_SEND: 'slack:send',
  SLACK_SUCCESS: 'slack:success',
  SLACK_ERROR: 'slack:error',
  DISCORD_SEND: 'discord:send',
  DISCORD_SUCCESS: 'discord:success',
  DISCORD_ERROR: 'discord:error',

  // CRM
  HUBSPOT_EXECUTE: 'hubspot:execute',
  HUBSPOT_SUCCESS: 'hubspot:success',
  HUBSPOT_ERROR: 'hubspot:error',
  SALESFORCE_EXECUTE: 'salesforce:execute',
  SALESFORCE_SUCCESS: 'salesforce:success',
  SALESFORCE_ERROR: 'salesforce:error',
  ZOHO_CRM_EXECUTE: 'zohoCRM:execute',
  ZOHO_CRM_SUCCESS: 'zohoCRM:success',
  ZOHO_CRM_ERROR: 'zohoCRM:error',
  MAILCHIMP_EXECUTE: 'mailchimp:execute',
  MAILCHIMP_SUCCESS: 'mailchimp:success',
  MAILCHIMP_ERROR: 'mailchimp:error',

  // Database
  AIRTABLE_EXECUTE: 'airtable:execute',
  AIRTABLE_SUCCESS: 'airtable:success',
  AIRTABLE_ERROR: 'airtable:error',
  NOTION_EXECUTE: 'notion:execute',
  NOTION_SUCCESS: 'notion:success',
  NOTION_ERROR: 'notion:error',

  // Payment
  STRIPE_EXECUTE: 'stripe:execute',
  STRIPE_SUCCESS: 'stripe:success',
  STRIPE_ERROR: 'stripe:error',

  // Analytics
  ANALYTICS_TRACK: 'analytics:track',
} as const;

export type IntegrationSocketEvent = typeof IntegrationSocketEvents[keyof typeof IntegrationSocketEvents];

export default {
  IntegrationSocketEvents,
};
