/**
 * The rich steps' words: the SDK's i18n (core/i18n.ts, generated from
 * conferbot-widget/src/ts/i18n). Kept so the step handlers and views that
 * import `t` from here read the active language; `key` is loose because
 * they build keys at run time.
 */
import { t as tr, I18nKey, I18nVars } from '../i18n';

/** A text by key in the active language, {name} placeholders filled (web i18n t). */
export const t = (key: string, vars?: I18nVars | Record<string, any>): string => tr(key as I18nKey, vars as I18nVars);
