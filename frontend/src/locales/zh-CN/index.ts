import auth from './auth';
import common from './common';
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

/** zh-CN 语言包：按模块拆分，汇总为单一 messages 对象 */
export default {
  common,
  errors,
  layout,
  auth,
  taskMeta,
  dashboard,
  tasksPage,
  taskCreate,
  files,
  settings,
  help,
  subscriptions,
} as const;
