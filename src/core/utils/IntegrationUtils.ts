/**
 * IntegrationUtils.ts
 *
 * Shared utility functions for integration handlers in the Conferbot React Native SDK.
 * Provides common functionality for validation, formatting, and data transformation.
 */

import { validateEmail } from './ValidationUtils';
import type {
  ContactData,
  EmailConfig,
  SlackBlock,
  SlackAttachment,
  DiscordEmbed,
  NotionProperty,
  NotionBlock,
  BaseIntegrationPayload,
} from './IntegrationTypes';

// ========================================
// EMAIL UTILITIES
// ========================================

/**
 * Validates multiple email addresses (comma-separated)
 * @param emails - Comma-separated email addresses
 * @returns Object with valid emails array and any invalid emails
 */
export function validateEmailList(emails: string): {
  valid: string[];
  invalid: string[];
  formatted: string;
} {
  const emailList = emails.split(',').map((e) => e.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emailList) {
    const result = validateEmail(email);
    if (result.isValid) {
      valid.push(result.sanitizedValue || email);
    } else {
      invalid.push(email);
    }
  }

  return {
    valid,
    invalid,
    formatted: valid.join(', '),
  };
}

/**
 * Formats email body with HTML if needed
 * @param body - Email body content
 * @param format - Format type: text or html
 * @returns Formatted email body
 */
export function formatEmailBody(body: string, format: 'text' | 'html' = 'text'): string {
  if (format === 'html') {
    // If body doesn't have HTML structure, wrap it
    if (!body.includes('<html') && !body.includes('<body')) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  </style>
</head>
<body>
  ${body.replace(/\n/g, '<br>')}
</body>
</html>`;
    }
  }
  return body;
}

/**
 * Validates email configuration
 * @param config - Email configuration to validate
 * @returns Validation result with errors array
 */
export function validateEmailConfig(config: EmailConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate recipient
  if (!config.to) {
    errors.push('Recipient email is required');
  } else {
    const toResult = validateEmailList(config.to);
    if (toResult.valid.length === 0) {
      errors.push('No valid recipient email addresses');
    }
    if (toResult.invalid.length > 0) {
      errors.push(`Invalid email addresses: ${toResult.invalid.join(', ')}`);
    }
  }

  // Validate CC if provided
  if (config.cc) {
    const ccResult = validateEmailList(config.cc);
    if (ccResult.invalid.length > 0) {
      errors.push(`Invalid CC email addresses: ${ccResult.invalid.join(', ')}`);
    }
  }

  // Validate BCC if provided
  if (config.bcc) {
    const bccResult = validateEmailList(config.bcc);
    if (bccResult.invalid.length > 0) {
      errors.push(`Invalid BCC email addresses: ${bccResult.invalid.join(', ')}`);
    }
  }

  // Validate reply-to if provided
  if (config.replyTo) {
    const replyResult = validateEmail(config.replyTo);
    if (!replyResult.isValid) {
      errors.push('Invalid reply-to email address');
    }
  }

  // Validate subject
  if (!config.subject || config.subject.trim().length === 0) {
    errors.push('Email subject is required');
  }

  // Validate body
  if (!config.body || config.body.trim().length === 0) {
    errors.push('Email body is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ========================================
// SLACK FORMATTING
// ========================================

/**
 * Formats a message for Slack with proper markdown
 * @param message - Plain text message
 * @param mentions - User IDs to mention
 * @returns Formatted Slack message
 */
export function formatSlackMessage(
  message: string,
  mentions?: string[]
): string {
  let formatted = message;

  // Convert markdown bold to Slack bold
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');

  // Convert markdown italic to Slack italic
  formatted = formatted.replace(/_(.*?)_/g, '_$1_');

  // Convert markdown code to Slack code
  formatted = formatted.replace(/`(.*?)`/g, '`$1`');

  // Add mentions
  if (mentions && mentions.length > 0) {
    const mentionStr = mentions.map((id) => `<@${id}>`).join(' ');
    formatted = `${mentionStr} ${formatted}`;
  }

  return formatted;
}

/**
 * Creates a Slack section block
 * @param text - Block text content
 * @param fields - Optional fields for the block
 * @returns Slack block object
 */
export function createSlackBlock(
  text: string,
  fields?: Array<{ title: string; value: string }>
): SlackBlock {
  const block: SlackBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text,
    },
  };

  if (fields && fields.length > 0) {
    block.fields = fields.map((f) => ({
      type: 'mrkdwn' as const,
      text: `*${f.title}*\n${f.value}`,
    }));
  }

  return block;
}

/**
 * Creates Slack attachments from data
 * @param data - Key-value data to format
 * @param color - Attachment color (default: blue)
 * @returns Slack attachment object
 */
export function createSlackAttachment(
  data: Record<string, unknown>,
  color: string = '#0066ff'
): SlackAttachment {
  const fields = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({
      title: formatFieldName(key),
      value: String(value),
      short: String(value).length < 30,
    }));

  return {
    color,
    fields,
    footer: 'Conferbot',
    ts: Math.floor(Date.now() / 1000),
  };
}

// ========================================
// DISCORD FORMATTING
// ========================================

/**
 * Formats a message for Discord with proper markdown
 * @param message - Plain text message
 * @param mentions - User IDs to mention
 * @returns Formatted Discord message
 */
export function formatDiscordMessage(
  message: string,
  mentions?: string[]
): string {
  let formatted = message;

  // Add mentions
  if (mentions && mentions.length > 0) {
    const mentionStr = mentions.map((id) => `<@${id}>`).join(' ');
    formatted = `${mentionStr} ${formatted}`;
  }

  return formatted;
}

/**
 * Creates a Discord embed from data
 * @param title - Embed title
 * @param description - Embed description
 * @param data - Key-value data for fields
 * @param color - Embed color (hex without #)
 * @returns Discord embed object
 */
export function createDiscordEmbed(
  title: string,
  description?: string,
  data?: Record<string, unknown>,
  color: number = 0x0066ff
): DiscordEmbed {
  const embed: DiscordEmbed = {
    title,
    color,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Conferbot',
    },
  };

  if (description) {
    embed.description = description;
  }

  if (data) {
    embed.fields = Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({
        name: formatFieldName(key),
        value: String(value),
        inline: String(value).length < 30,
      }));
  }

  return embed;
}

// ========================================
// CRM DATA FORMATTING
// ========================================

/**
 * Formats contact data for HubSpot API
 * @param contact - Contact data
 * @param additionalFields - Additional custom fields
 * @returns HubSpot-formatted properties object
 */
export function formatHubSpotContact(
  contact: ContactData,
  additionalFields?: Record<string, unknown>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  // Map standard fields to HubSpot property names
  if (contact.email) properties.email = contact.email;
  if (contact.firstName) properties.firstname = contact.firstName;
  if (contact.lastName) properties.lastname = contact.lastName;
  if (contact.phone) properties.phone = contact.phone;
  if (contact.company) properties.company = contact.company;
  if (contact.jobTitle) properties.jobtitle = contact.jobTitle;
  if (contact.website) properties.website = contact.website;
  if (contact.address) properties.address = contact.address;
  if (contact.city) properties.city = contact.city;
  if (contact.state) properties.state = contact.state;
  if (contact.country) properties.country = contact.country;
  if (contact.postalCode) properties.zip = contact.postalCode;
  if (contact.notes) properties.hs_lead_status = contact.notes;

  // Add custom fields
  if (contact.customFields) {
    Object.assign(properties, contact.customFields);
  }

  // Add additional fields
  if (additionalFields) {
    Object.assign(properties, additionalFields);
  }

  return properties;
}

/**
 * Formats contact data for Zoho CRM API
 * @param contact - Contact data
 * @param module - Zoho CRM module (Contacts, Leads, etc.)
 * @returns Zoho CRM-formatted record
 */
export function formatZohoCRMRecord(
  contact: ContactData,
  module: string = 'Contacts'
): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  // Map fields based on module type
  if (module === 'Leads') {
    if (contact.firstName) record.First_Name = contact.firstName;
    if (contact.lastName) record.Last_Name = contact.lastName;
    if (contact.email) record.Email = contact.email;
    if (contact.phone) record.Phone = contact.phone;
    if (contact.company) record.Company = contact.company;
    if (contact.jobTitle) record.Designation = contact.jobTitle;
    if (contact.website) record.Website = contact.website;
    if (contact.address) record.Street = contact.address;
    if (contact.city) record.City = contact.city;
    if (contact.state) record.State = contact.state;
    if (contact.country) record.Country = contact.country;
    if (contact.postalCode) record.Zip_Code = contact.postalCode;
    if (contact.source) record.Lead_Source = contact.source;
    if (contact.notes) record.Description = contact.notes;
  } else {
    // Default mapping for Contacts
    if (contact.firstName) record.First_Name = contact.firstName;
    if (contact.lastName) record.Last_Name = contact.lastName;
    if (contact.email) record.Email = contact.email;
    if (contact.phone) record.Phone = contact.phone;
    if (contact.jobTitle) record.Title = contact.jobTitle;
    if (contact.address) record.Mailing_Street = contact.address;
    if (contact.city) record.Mailing_City = contact.city;
    if (contact.state) record.Mailing_State = contact.state;
    if (contact.country) record.Mailing_Country = contact.country;
    if (contact.postalCode) record.Mailing_Zip = contact.postalCode;
    if (contact.notes) record.Description = contact.notes;
  }

  // Add custom fields
  if (contact.customFields) {
    Object.assign(record, contact.customFields);
  }

  return record;
}

/**
 * Formats contact data for Salesforce API
 * @param contact - Contact data
 * @param objectType - Salesforce object type (Contact, Lead, etc.)
 * @returns Salesforce-formatted record
 */
export function formatSalesforceRecord(
  contact: ContactData,
  objectType: string = 'Contact'
): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  if (objectType === 'Lead') {
    if (contact.firstName) record.FirstName = contact.firstName;
    if (contact.lastName) record.LastName = contact.lastName;
    if (contact.email) record.Email = contact.email;
    if (contact.phone) record.Phone = contact.phone;
    if (contact.company) record.Company = contact.company;
    if (contact.jobTitle) record.Title = contact.jobTitle;
    if (contact.website) record.Website = contact.website;
    if (contact.address) record.Street = contact.address;
    if (contact.city) record.City = contact.city;
    if (contact.state) record.State = contact.state;
    if (contact.country) record.Country = contact.country;
    if (contact.postalCode) record.PostalCode = contact.postalCode;
    if (contact.source) record.LeadSource = contact.source;
    if (contact.notes) record.Description = contact.notes;
  } else {
    // Contact object
    if (contact.firstName) record.FirstName = contact.firstName;
    if (contact.lastName) record.LastName = contact.lastName;
    if (contact.email) record.Email = contact.email;
    if (contact.phone) record.Phone = contact.phone;
    if (contact.jobTitle) record.Title = contact.jobTitle;
    if (contact.address) record.MailingStreet = contact.address;
    if (contact.city) record.MailingCity = contact.city;
    if (contact.state) record.MailingState = contact.state;
    if (contact.country) record.MailingCountry = contact.country;
    if (contact.postalCode) record.MailingPostalCode = contact.postalCode;
    if (contact.notes) record.Description = contact.notes;
  }

  // Add custom fields
  if (contact.customFields) {
    Object.assign(record, contact.customFields);
  }

  return record;
}

// ========================================
// AIRTABLE FORMATTING
// ========================================

/**
 * Formats data for Airtable fields
 * @param data - Raw data object
 * @returns Airtable-formatted fields object
 */
export function formatAirtableFields(
  data: Record<string, unknown>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip null/undefined values
    if (value === null || value === undefined) continue;

    // Format field name (capitalize first letter of each word)
    const fieldName = formatFieldName(key);

    // Handle different value types
    if (Array.isArray(value)) {
      // Arrays might be multi-select or linked records
      fields[fieldName] = value;
    } else if (typeof value === 'object' && value !== null) {
      // Objects might need special handling (attachments, etc.)
      if ('url' in value) {
        // Attachment format
        fields[fieldName] = [value];
      } else {
        // Stringify complex objects
        fields[fieldName] = JSON.stringify(value);
      }
    } else {
      fields[fieldName] = value;
    }
  }

  return fields;
}

// ========================================
// NOTION FORMATTING
// ========================================

/**
 * Creates a Notion property value
 * @param type - Property type
 * @param value - Property value
 * @returns Notion-formatted property
 */
export function createNotionProperty(
  type: NotionProperty['type'],
  value: string | number | boolean | string[]
): Record<string, unknown> {
  switch (type) {
    case 'title':
      return {
        title: [{ type: 'text', text: { content: String(value) } }],
      };
    case 'rich_text':
      return {
        rich_text: [{ type: 'text', text: { content: String(value) } }],
      };
    case 'number':
      return { number: Number(value) };
    case 'select':
      return { select: { name: String(value) } };
    case 'multi_select':
      return {
        multi_select: (Array.isArray(value) ? value : [value]).map((v) => ({
          name: String(v),
        })),
      };
    case 'date':
      return { date: { start: String(value) } };
    case 'checkbox':
      return { checkbox: Boolean(value) };
    case 'url':
      return { url: String(value) };
    case 'email':
      return { email: String(value) };
    case 'phone_number':
      return { phone_number: String(value) };
    default:
      return { rich_text: [{ type: 'text', text: { content: String(value) } }] };
  }
}

/**
 * Creates a Notion content block
 * @param type - Block type
 * @param text - Block text content
 * @param checked - For to_do blocks, whether checked
 * @returns Notion-formatted block
 */
export function createNotionBlock(
  type: NotionBlock['type'],
  text?: string,
  checked?: boolean
): Record<string, unknown> {
  const richText = text
    ? [{ type: 'text', text: { content: text } }]
    : [];

  switch (type) {
    case 'paragraph':
      return { type: 'paragraph', paragraph: { rich_text: richText } };
    case 'heading_1':
      return { type: 'heading_1', heading_1: { rich_text: richText } };
    case 'heading_2':
      return { type: 'heading_2', heading_2: { rich_text: richText } };
    case 'heading_3':
      return { type: 'heading_3', heading_3: { rich_text: richText } };
    case 'bulleted_list_item':
      return { type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText } };
    case 'numbered_list_item':
      return { type: 'numbered_list_item', numbered_list_item: { rich_text: richText } };
    case 'to_do':
      return { type: 'to_do', to_do: { rich_text: richText, checked: checked ?? false } };
    case 'divider':
      return { type: 'divider', divider: {} };
    default:
      return { type: 'paragraph', paragraph: { rich_text: richText } };
  }
}

/**
 * Formats data into Notion properties
 * @param data - Raw data object
 * @param titleField - Field to use as title (default: first string field)
 * @returns Notion-formatted properties
 */
export function formatNotionProperties(
  data: Record<string, unknown>,
  titleField?: string
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  let foundTitle = false;

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    const fieldName = formatFieldName(key);

    // Check if this should be the title
    if (titleField && key === titleField) {
      properties[fieldName] = createNotionProperty('title', String(value));
      foundTitle = true;
      continue;
    }

    // Auto-detect property type
    if (typeof value === 'number') {
      properties[fieldName] = createNotionProperty('number', value);
    } else if (typeof value === 'boolean') {
      properties[fieldName] = createNotionProperty('checkbox', value);
    } else if (Array.isArray(value)) {
      properties[fieldName] = createNotionProperty('multi_select', value);
    } else if (typeof value === 'string') {
      // Check if it looks like an email, URL, phone, or date
      if (value.includes('@') && validateEmail(value).isValid) {
        properties[fieldName] = createNotionProperty('email', value);
      } else if (value.match(/^https?:\/\//)) {
        properties[fieldName] = createNotionProperty('url', value);
      } else if (value.match(/^\+?[\d\s\-()]{7,}$/)) {
        properties[fieldName] = createNotionProperty('phone_number', value);
      } else if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        properties[fieldName] = createNotionProperty('date', value);
      } else if (!foundTitle && !titleField) {
        // Use first string field as title if no title specified
        properties[fieldName] = createNotionProperty('title', value);
        foundTitle = true;
      } else {
        properties[fieldName] = createNotionProperty('rich_text', value);
      }
    } else {
      properties[fieldName] = createNotionProperty('rich_text', JSON.stringify(value));
    }
  }

  return properties;
}

// ========================================
// GOOGLE SHEETS FORMATTING
// ========================================

/**
 * Formats data for Google Sheets row
 * @param data - Raw data object
 * @param columnMappings - Optional column mappings
 * @returns Array of values for row insertion
 */
export function formatGoogleSheetsRow(
  data: Record<string, unknown>,
  columnMappings?: Array<{ column: string; value: string }>
): unknown[] {
  if (columnMappings && columnMappings.length > 0) {
    // Use explicit column order
    return columnMappings.map((mapping) => {
      const value = data[mapping.value] ?? data[mapping.column];
      return formatCellValue(value);
    });
  }

  // Use natural object order
  return Object.values(data).map(formatCellValue);
}

/**
 * Formats a value for a Google Sheets cell
 * @param value - Raw value
 * @returns Formatted cell value
 */
function formatCellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ========================================
// STRIPE FORMATTING
// ========================================

/**
 * Formats amount for Stripe (converts to cents)
 * @param amount - Amount in decimal (e.g., 19.99)
 * @param currency - Currency code
 * @returns Amount in smallest currency unit (cents for USD)
 */
export function formatStripeAmount(
  amount: number,
  currency: string = 'USD'
): number {
  // Zero-decimal currencies don't need conversion
  const zeroDecimalCurrencies = [
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
  ];

  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return Math.round(amount);
  }

  // Convert to cents
  return Math.round(amount * 100);
}

/**
 * Formats Stripe metadata from answers
 * @param answers - Collected answers
 * @param maxLength - Max value length (Stripe limit is 500)
 * @returns Stripe-formatted metadata
 */
export function formatStripeMetadata(
  answers: Record<string, unknown>,
  maxLength: number = 500
): Record<string, string> {
  const metadata: Record<string, string> = {};

  for (const [key, value] of Object.entries(answers)) {
    if (value === null || value === undefined) continue;

    // Stripe metadata keys can only be strings up to 40 chars
    const safeKey = key.substring(0, 40);

    // Stripe metadata values can only be strings up to 500 chars
    let stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (stringValue.length > maxLength) {
      stringValue = stringValue.substring(0, maxLength - 3) + '...';
    }

    metadata[safeKey] = stringValue;
  }

  return metadata;
}

// ========================================
// COMMON UTILITIES
// ========================================

/**
 * Formats a field name for display (e.g., firstName -> First Name)
 * @param fieldName - Raw field name
 * @returns Formatted field name
 */
export function formatFieldName(fieldName: string): string {
  return fieldName
    // Add space before capital letters
    .replace(/([A-Z])/g, ' $1')
    // Replace underscores and hyphens with spaces
    .replace(/[_-]/g, ' ')
    // Capitalize first letter of each word
    .replace(/\b\w/g, (c) => c.toUpperCase())
    // Trim and remove double spaces
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Extracts contact data from answers and user metadata
 * @param answers - Collected answers
 * @param userMetadata - User metadata
 * @returns Extracted contact data
 */
export function extractContactData(
  answers: Record<string, unknown>,
  userMetadata?: Record<string, unknown>
): ContactData {
  const contact: ContactData = {};

  // Common email field names
  const emailFields = ['email', 'e-mail', 'emailAddress', 'email_address', 'userEmail'];
  // Common name field names
  const nameFields = ['name', 'fullName', 'full_name', 'userName', 'displayName'];
  const firstNameFields = ['firstName', 'first_name', 'fname', 'givenName'];
  const lastNameFields = ['lastName', 'last_name', 'lname', 'familyName', 'surname'];
  // Common phone field names
  const phoneFields = ['phone', 'phoneNumber', 'phone_number', 'mobile', 'telephone', 'tel'];
  // Common company field names
  const companyFields = ['company', 'companyName', 'company_name', 'organization', 'org'];

  const combined = { ...answers, ...userMetadata };

  // Extract email
  for (const field of emailFields) {
    if (combined[field] && typeof combined[field] === 'string') {
      contact.email = combined[field] as string;
      break;
    }
  }

  // Extract first name
  for (const field of firstNameFields) {
    if (combined[field] && typeof combined[field] === 'string') {
      contact.firstName = combined[field] as string;
      break;
    }
  }

  // Extract last name
  for (const field of lastNameFields) {
    if (combined[field] && typeof combined[field] === 'string') {
      contact.lastName = combined[field] as string;
      break;
    }
  }

  // If no separate first/last, try full name
  if (!contact.firstName && !contact.lastName) {
    for (const field of nameFields) {
      if (combined[field] && typeof combined[field] === 'string') {
        const parts = (combined[field] as string).split(' ');
        contact.firstName = parts[0];
        contact.lastName = parts.slice(1).join(' ') || undefined;
        break;
      }
    }
  }

  // Extract phone
  for (const field of phoneFields) {
    if (combined[field] && typeof combined[field] === 'string') {
      contact.phone = combined[field] as string;
      break;
    }
  }

  // Extract company
  for (const field of companyFields) {
    if (combined[field] && typeof combined[field] === 'string') {
      contact.company = combined[field] as string;
      break;
    }
  }

  // Add any remaining fields as custom fields
  const knownFields = new Set([
    ...emailFields,
    ...nameFields,
    ...firstNameFields,
    ...lastNameFields,
    ...phoneFields,
    ...companyFields,
  ]);

  contact.customFields = {};
  for (const [key, value] of Object.entries(combined)) {
    if (!knownFields.has(key) && value !== null && value !== undefined) {
      contact.customFields[key] = value;
    }
  }

  return contact;
}

/**
 * Removes empty/null/undefined values from an object
 * @param obj - Object to clean
 * @returns Cleaned object
 */
export function removeEmptyValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
  ) as Partial<T>;
}

/**
 * Deep resolves variables in an object using a resolver function
 * @param obj - Object to resolve
 * @param resolver - Variable resolver function
 * @returns Object with resolved variables
 */
export function deepResolveVariables<T>(
  obj: T,
  resolver: (text: string) => string
): T {
  if (typeof obj === 'string') {
    return resolver(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepResolveVariables(item, resolver)) as T;
  }

  if (typeof obj === 'object' && obj !== null) {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = deepResolveVariables(value, resolver);
    }
    return resolved as T;
  }

  return obj;
}

/**
 * Builds the common base payload for integration requests
 * @param sessionId - Chat session ID
 * @param botId - Bot ID
 * @param nodeId - Node ID
 * @param userMetadata - Optional user metadata
 * @param answers - Optional collected answers
 * @returns Base integration payload
 */
export function buildBasePayload(
  sessionId: string,
  botId: string,
  nodeId: string,
  userMetadata?: Record<string, unknown>,
  answers?: Record<string, unknown>
): BaseIntegrationPayload {
  return {
    sessionId,
    botId,
    timestamp: new Date().toISOString(),
    nodeId,
    userMetadata,
    answers,
  };
}

/**
 * Safely parses JSON string, returns original if not valid JSON
 * @param value - Value to parse
 * @returns Parsed object or original value
 */
export function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Validates a webhook URL
 * @param url - URL to validate
 * @returns Validation result
 */
export function validateWebhookUrl(url: string): {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
} {
  if (!url || url.trim().length === 0) {
    return { isValid: false, error: 'Webhook URL is required' };
  }

  const trimmed = url.trim();

  // Check for valid protocol
  if (!trimmed.match(/^https?:\/\//i)) {
    return { isValid: false, error: 'Webhook URL must start with http:// or https://' };
  }

  try {
    const parsed = new URL(trimmed);
    return { isValid: true, sanitizedUrl: parsed.href };
  } catch {
    return { isValid: false, error: 'Invalid webhook URL format' };
  }
}

export default {
  // Email
  validateEmailList,
  formatEmailBody,
  validateEmailConfig,

  // Slack
  formatSlackMessage,
  createSlackBlock,
  createSlackAttachment,

  // Discord
  formatDiscordMessage,
  createDiscordEmbed,

  // CRM
  formatHubSpotContact,
  formatZohoCRMRecord,
  formatSalesforceRecord,

  // Airtable
  formatAirtableFields,

  // Notion
  createNotionProperty,
  createNotionBlock,
  formatNotionProperties,

  // Google Sheets
  formatGoogleSheetsRow,

  // Stripe
  formatStripeAmount,
  formatStripeMetadata,

  // Common
  formatFieldName,
  extractContactData,
  removeEmptyValues,
  deepResolveVariables,
  buildBasePayload,
  safeJsonParse,
  validateWebhookUrl,
};
