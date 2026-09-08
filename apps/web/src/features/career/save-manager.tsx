'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

export function SaveManager() {
  const [key, setKey] = useState('');
  const [recovery, setRecovery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function showKey() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '복구 키를 불러오지 못했습니다.');
      if (data.mode !== 'guest') throw new Error('이 사이트는 로그인 계정에 저장됩니다.');
      setKey(data.recoveryKey);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryKey: recovery.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '저장된 커리어를 찾지 못했습니다.');
      window.location.assign('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '다시 시도해 주세요.');
      setBusy(false);
    }
  }

  return (
    <main className="save-manager">
      <Link className="text-button" href="/">
        ← 게임으로
      </Link>
      <h1>게스트 저장 관리</h1>
      <p>
        진행 상황은 자동 저장됩니다. 같은 브라우저에서 다시 접속하면 이어서 플레이할 수 있습니다.
      </p>
      <section className="panel panel-content">
        <h2>내 복구 키</h2>
        <p>
          브라우저 데이터를 지우거나 다른 기기에서 이어 하려면 복구 키가 필요합니다. 키를 가진
          사람은 커리어에 접근할 수 있으니 개인적으로 보관하세요.
        </p>
        <button className="button" disabled={busy} onClick={showKey}>
          복구 키 보기
        </button>
        {key && (
          <label className="save-key-label">
            개인 보관용 복구 키
            <textarea
              readOnly
              value={key}
              rows={3}
              onFocus={(event) => event.currentTarget.select()}
              spellCheck={false}
            />
          </label>
        )}
      </section>
      <section className="panel panel-content">
        <h2>저장된 커리어 열기</h2>
        <p>
          복구 키를 입력하면 이 브라우저에서 해당 커리어를 엽니다. 현재 커리어로 돌아오려면 먼저
          위의 복구 키를 보관하세요.
        </p>
        <form onSubmit={restore}>
          <label className="save-key-label" htmlFor="recovery-key">
            복구 키
          </label>
          <input
            id="recovery-key"
            type="password"
            autoComplete="off"
            value={recovery}
            onChange={(event) => setRecovery(event.target.value)}
            required
            minLength={64}
            maxLength={64}
            spellCheck={false}
          />
          <button
            className="button primary"
            type="submit"
            disabled={busy || recovery.trim().length !== 64}
          >
            커리어 열기
          </button>
        </form>
      </section>
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
