import auth from './auth';
import common from './common';
import admin from './admin';
import dashboard from './dashboard';
import errors from './errors';
import files from './files';
import help from './help';
import layout from './layout';
import settings from './settings';
import subscriptions from './subscriptions';
import taskCreate from './taskCreate';
import taskMeta from './taskMeta';
import tasksPage from './tasksPage';
import urlExtract from './urlExtract';

/** zh-CN 语言包：按模块拆分，汇总为单一 messages 对象 */
export default {
  common,
  errors,
  layout,
  auth,
  admin,
  taskMeta,
  dashboard,
  tasksPage,
  taskCreate,
  files,
  settings,
  help,
  subscriptions,
  urlExtract,
} as const;
