import { useI18n } from 'vue-i18n';
import type { TaskSourceType, TaskStatus } from '@/types/models';

export function useTaskLabels() {
  const { t } = useI18n();

  function sourceTypeLabel(type: TaskSourceType): string {
    return t(`taskMeta.sourceType.${type}`);
  }

  function taskStatusLabel(status: TaskStatus): string {
    return t(`taskMeta.status.${status}`);
  }

  return { sourceTypeLabel, taskStatusLabel };
}
