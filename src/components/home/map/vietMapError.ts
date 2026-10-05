export function sanitizeVietMapError(message: string): string {
  return message.replace(/([?&](?:apikey|apiKey|key)=)[^&\s]+/g, '$1[REDACTED]')
}
