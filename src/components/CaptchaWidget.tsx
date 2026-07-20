import { Turnstile } from '@marsidev/react-turnstile';
import { turnstileSiteKey } from '../lib/captcha';

export default function CaptchaWidget({
  onTokenChange,
  resetKey,
}: {
  onTokenChange: (token: string | null) => void;
  resetKey: number;
}) {
  if (!turnstileSiteKey) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700" role="alert">
        CAPTCHAの設定が見つかりません。管理者にお問い合わせください。
      </p>
    );
  }

  return (
    <div className="flex min-h-16 justify-center overflow-hidden" aria-label="ボット対策の確認">
      <Turnstile
        key={resetKey}
        siteKey={turnstileSiteKey}
        onSuccess={token => onTokenChange(token)}
        onError={() => onTokenChange(null)}
        onExpire={() => onTokenChange(null)}
        options={{ action: 'authenticate', language: 'ja', size: 'flexible', theme: 'light' }}
      />
    </div>
  );
}
