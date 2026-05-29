export default {
  loginTagline:
    'Sign in to create downloads, track progress, and manage files.',
  email: 'Email',
  password: 'Password',
  captcha: 'Verification',
  captchaPlaceholder: 'Enter the characters shown',
  captchaAlt: 'Captcha',
  captchaLoading: 'Loading…',
  captchaNotLoaded: 'Not loaded',
  refreshCaptcha: 'New image',
  refreshCaptchaTitle: 'Refresh captcha',
  needCaptchaFirst: 'Please load the captcha first.',
  loggingIn: 'Signing in…',
  login: 'Sign in',
  noAccount: 'No account yet?',
  registerLink: 'Register',
  urlExtractPublicLink: 'URL extract',
  captchaLoadFallback:
    'Could not load captcha. Ensure the API and Redis are running, then refresh.',
  invalidLoginFallback: 'Incorrect username or password.',
  createAccount: 'Create account',
  registerTagline:
    'Register to add download tasks and manage saved files.',
  nicknameLabel: 'Display name (optional, shown in the header)',
  passwordHint: 'Password (min. 8 characters)',
  confirmPassword: 'Confirm password',
  pwdMismatchHint: 'Passwords do not match. Please check and try again.',
  pwdMismatchSubmit: 'Passwords do not match. Please fix and submit again.',
  pwdTooShort: 'Password must be at least 8 characters.',
  submitting: 'Submitting…',
  register: 'Register',
  hasAccount: 'Already have an account?',
  backToLogin: 'Back to sign in',
  registerFailed:
    'Registration failed. The email may already exist, or the network is unstable.',

  registerNeedEmail: 'Please enter your email first.',
  registerCodeSentHint:
    'If this email can register and mail is enabled, you will receive a code shortly (check spam).',
  registerEmailCodeLabel: 'Email verification code',
  registerEmailCodePlaceholder: 'Enter 6 digits',
  registerSendCode: 'Send code',
  registerSendingCode: 'Sending…',
  registerResendCooldown: 'Resend in {sec}s',
  registerCaptchaBeforeCodeHint: 'Solve the captcha before requesting an email code.',
  registerCaptchaResendHint:
    'Enter the new captcha characters before requesting another email code.',
  registerCodeFormat: 'Enter the 6-digit verification code.',

  forgotPasswordLink: 'Forgot password?',
  forgotPasswordTitle: 'Forgot password',
  forgotPasswordTagline:
    'We will email you a reset link if the account exists.',
  forgotSubmit: 'Send reset email',
  forgotSending: 'Sending…',
  forgotPasswordDoneHint:
    'If an account exists for this email, you will receive instructions shortly (check spam folders). To avoid account enumeration we always show this message.',
  invalidResetToken:
    'Missing or invalid reset link. Request a new one from Forgot password.',
  resetPasswordTitle: 'Reset password',
  resetPasswordTagline: 'Choose a new password, then sign in with it.',
  resetPasswordSubmit: 'Update password',
  resetSubmitting: 'Saving…',
  resetSuccessHint: 'Your password was updated. You can sign in now.',
  resetLinkInvalidHint: 'Invalid or expired reset link',
} as const;
