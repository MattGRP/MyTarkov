import { GameMode } from '@/constants/gameMode';

export interface TurnstileTokenModalProps {
  visible: boolean;
  onClose?: () => void;
  onTokenCaptured: (token: string) => void;
  onError?: (message: string) => void;
  searchName?: string;
  silent?: boolean;
  timeoutMs?: number;
  gameMode?: GameMode;
}
