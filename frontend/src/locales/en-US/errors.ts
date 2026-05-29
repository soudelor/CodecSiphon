export default {
  operationFailed: 'Operation failed',
  operationFailedRetry: 'Something went wrong. Please try again later.',
  loadSettingsFailed:
    'Could not load settings. Make sure you are signed in, then check your network.',
  networkError: 'Network error. Please try again later.',

  previewUrlRequired: 'Please enter a URL',
  previewMetadataArray:
    'Could not read video info from this page (unexpected response shape).',
  previewMetadataInvalid: 'This link does not look like a supported media page.',
  previewMetadataCookieFileMissing:
    'The server is missing a configured cookie file. Ask an administrator to fix the setup.',
  previewMetadataTimeout: 'The check timed out. Please try again later.',
  previewMetadataTooLarge: 'The response was too large. Try another link or try again later.',
  previewMetadataToolFailed: 'The checker is temporarily unavailable. Please try again later.',
  previewMetadataEmpty: 'No usable content was returned for this link.',
  previewMetadataNull:
    'Could not fetch video info for this link. Some sites require the server to be signed in; ask an administrator if this keeps happening.',
  previewMetadataParseFailed: 'Could not parse the video metadata. Please try again later.',
  previewMetadataFailed: 'Link check failed. Please try again later.',
  urlExtractRateLimited: 'Too many requests. Please try again later.',
  urlExtractDouyinHomeFeed:
    'This Douyin home or feed URL cannot list videos. Use a single video page (/video/…) or an author profile works list URL instead.',
  urlExtractDouyinNeedDeepLink:
    'This Douyin URL is not a video or works list page. Open a specific video or the author works tab and paste that full URL.',
  urlExtractSampleInvalidUrl: 'Invalid media URL',
  urlExtractSampleFailed:
    'Could not download the clip. Ensure ffmpeg is installed on the server, or try again later.',

  storageQuotaEnqueueDenied:
    'Your storage quota is full. Delete some files or ask an administrator to raise your quota before creating new download tasks.',

  registrationMailDisabled:
    'Registration mail is disabled: SMTP is not configured on the server. Try again later or contact an administrator.',
  registrationMailSendFailed:
    'Could not send the registration code email. Please try again later or contact an administrator.',
  registrationCodeInvalid:
    'The email verification code is invalid, has too many attempts, or has expired. Request a new code.',
  emailTaken: 'This email is already registered. Sign in or use another email.',
  registrationTooManyRequests: 'Too many requests. Please try again later.',
  registrationServiceUnavailable:
    'Registration verification is unavailable (database not migrated). Ask an administrator to run `npm run prisma:migrate`, or try again later.',
} as const;
