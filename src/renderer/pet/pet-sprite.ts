import { PET_SPRITE_STATES } from '../../shared/pet-types';

export function setSpriteImage(url: string): void {
  const el = getPetElement();
  if (el) {
    el.style.setProperty('--sprite-url', `url("${url}")`);
  }
}

export function setPetAction(stateId: string): void {
  const el = getPetElement();
  if (!el) return;

  const state = PET_SPRITE_STATES.find(s => s.id === stateId);
  if (!state) return;

  el.style.setProperty('--sprite-row', String(state.row));
  el.style.setProperty('--sprite-frames', String(state.frames));
  el.style.setProperty('--sprite-duration', `${state.durationMs}ms`);

  // 重启动画
  const currentAnimation = el.style.animation;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = currentAnimation || '';
}

export function getPetElement(): HTMLElement | null {
  return document.getElementById('pet-sprite');
}
