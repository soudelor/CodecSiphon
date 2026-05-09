export default {
  sourceType: {
    single_url: 'Single URL',
    multi_url: 'Multiple URLs',
    playlist: 'Playlist',
    subscription: 'Subscription',
  },
  status: {
    pending: 'Pending',
    queued: 'Queued',
    parsing: 'Parsing',
    downloading: 'Downloading',
    processing: 'Processing',
    completed: 'Completed',
    paused: 'Paused',
    cancelled: 'Cancelled',
    failed: 'Failed',
  },
} as const;
