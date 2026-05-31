import { PetAction } from '../../shared/pet-types';

function pathBasename(filePath: unknown): string {
  if (typeof filePath !== 'string') return '...';
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

export function mapEventToAction(event: Record<string, unknown>): PetAction {
  const eventName = event.hook_event_name as string;
  const toolName = event.tool_name as string | undefined;
  const toolInput = event.tool_input as Record<string, unknown> | undefined;

  switch (eventName) {
    case 'SessionStart':
      return { stateId: 'waving', bubbleText: '开始工作吧！', triggerAi: false };

    case 'PostToolUse': {
      switch (toolName) {
        case 'Read':
          return {
            stateId: 'review',
            bubbleText: `正在读取 ${pathBasename(toolInput?.file_path)}...`,
            triggerAi: false,
          };
        case 'Edit':
          return {
            stateId: 'running-right',
            bubbleText: `正在编辑 ${pathBasename(toolInput?.file_path)}`,
            triggerAi: false,
          };
        case 'Write':
          return {
            stateId: 'running-left',
            bubbleText: `正在写入 ${pathBasename(toolInput?.file_path)}`,
            triggerAi: false,
          };
        case 'Bash':
          return { stateId: 'running', bubbleText: '执行命令中...', triggerAi: false };
        case 'Glob':
        case 'Grep':
          return { stateId: 'waiting', bubbleText: '搜索中...', triggerAi: false };
        default:
          return { stateId: 'idle', bubbleText: '工作中...', triggerAi: false };
      }
    }

    case 'PostToolUseFailure':
      return { stateId: 'failed', bubbleText: '哎呀，出错了', triggerAi: false, aiScene: 'error' };

    case 'Stop':
      return {
        stateId: 'jumping',
        bubbleText: '任务完成！',
        triggerAi: Math.random() < 0.6,
        aiScene: 'task_complete',
      };

    case 'StopFailure':
      return {
        stateId: 'failed',
        bubbleText: '遇到错误...',
        triggerAi: Math.random() < 0.4,
        aiScene: 'error',
      };

    case 'Notification': {
      const notifType = event.notification_type as string;
      if (notifType === 'idle_prompt') {
        return {
          stateId: 'waiting',
          bubbleText: '在等你回来...',
          triggerAi: true,
          aiScene: 'idle',
        };
      }
      return { stateId: 'idle', bubbleText: '', triggerAi: false };
    }

    case 'TaskCompleted': {
      const subject = event.task_subject as string | undefined;
      return {
        stateId: 'jumping',
        bubbleText: subject ? `完成: ${subject.slice(0, 40)}` : '任务完成！',
        triggerAi: true,
        aiScene: 'task_complete',
      };
    }

    case 'SessionEnd':
      return { stateId: 'waving', bubbleText: '下次见！', triggerAi: false };

    default:
      return { stateId: 'idle', bubbleText: '', triggerAi: false };
  }
}
