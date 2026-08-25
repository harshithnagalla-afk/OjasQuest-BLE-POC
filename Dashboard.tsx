import { useCallback, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { CHARACTERISTIC_UUIDS, REQUEST_DEVICE_OPTIONS, SERVICE_UUID } from './bluetoothConfig';
import { getSessionToken, signOutUser } from './firebase';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Empty/unset means "call the API on this same origin" — true on Vercel,
// where frontend/api/*.js is deployed alongside the built frontend on the
// same domain, so a relative /api/... URL is all that's needed. Local dev
// still sets this explicitly to http://localhost:4000 (see frontend/.env)
// since the Express backend runs on a different port there.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

interface Props {
  user: User;
}

export default function Dashboard({ user }: Props) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairResult, setPairResult] = useState<'idle' | 'pairing' | 'paired' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [commandText, setCommandText] = useState('');

  // GATT handles kept out of React state — they're mutable browser objects,
  // not render-driving data. Refs survive re-renders without re-triggering
  // the connect flow.
  const commandCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 50));
  }, []);

  async function handleConnectClick() {
    if (!navigator.bluetooth) {
      setStatus('error');
      setStatusMessage('This browser does not support Web Bluetooth. Try Chrome or Edge on desktop/Android.');
      return;
    }

    setStatus('connecting');
    setStatusMessage(null);

    try {
      // Opens the browser's native device chooser. Must be called directly
      // from this click handler — browsers reject requestDevice() calls
      // that aren't triggered by a user gesture.
      const device = await navigator.bluetooth.requestDevice(REQUEST_DEVICE_OPTIONS);
      deviceRef.current = device;
      device.addEventListener('gattserverdisconnected', handleGattDisconnected);

      if (!device.gatt) throw new Error('Selected device has no GATT server.');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);

      // 1. Read the device's unique identifier.
      const idChar = await service.getCharacteristic(CHARACTERISTIC_UUIDS.DEVICE_ID);
      const idValue = await idChar.readValue();
      const id = new TextDecoder().decode(idValue.buffer);

      // 2. Subscribe to status notifications for the live panel.
      const statusChar = await service.getCharacteristic(CHARACTERISTIC_UUIDS.STATUS);
      await statusChar.startNotifications();
      statusChar.addEventListener('characteristicvaluechanged', (ev) => {
        const target = ev.target as BluetoothRemoteGATTCharacteristic;
        if (!target.value) return;
        appendLog(`Notify: ${new TextDecoder().decode(target.value.buffer)}`);
      });

      // 3. Keep the command characteristic handy for the write panel below.
      commandCharRef.current = await service.getCharacteristic(CHARACTERISTIC_UUIDS.COMMAND);

      setDeviceName(device.name ?? 'Unnamed device');
      setDeviceId(id);
      setStatus('connected');
      appendLog(`Connected to ${device.name ?? device.id}`);

      await pairDeviceWithAccount({ deviceId: id, deviceName: device.name ?? null, browserDeviceId: device.id });
    } catch (err) {
      setStatus('error');
      setStatusMessage(readableBluetoothError(err));
    }
  }

  function handleGattDisconnected() {
    setStatus('disconnected');
    setStatusMessage('Device disconnected.');
    commandCharRef.current = null;
  }

  function handleDisconnectClick() {
    deviceRef.current?.gatt?.disconnect();
  }

  /** Sends the paired device's ID + the user's Firebase ID token to the
   *  backend so it can record the user_id -> device_id association. This
   *  is the "application-level ownership" step — pairing over Bluetooth
   *  alone doesn't grant any account access by itself. */
  async function pairDeviceWithAccount(payload: { deviceId: string; deviceName: string | null; browserDeviceId: string }) {
    setPairResult('pairing');
    try {
      const token = await getSessionToken();
      const res = await fetch(`${API_BASE_URL}/api/devices/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Backend responded with ${res.status}`);
      }
      setPairResult('paired');
      appendLog('Device registered to your account.');
    } catch (err) {
      setPairResult('error');
      appendLog(`Pairing with account failed: ${(err as Error).message}`);
    }
  }

  async function handleSendCommand(e: FormEvent) {
    e.preventDefault();
    const char = commandCharRef.current;
    if (!char || !commandText.trim()) return;
    try {
      await char.writeValue(new TextEncoder().encode(commandText));
      appendLog(`Sent: ${commandText}`);
      setCommandText('');
    } catch (err) {
      appendLog(`Write failed: ${(err as Error).message}`);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {user.photoURL && (
          <img src={user.photoURL} alt="" width={40} height={40} style={{ borderRadius: '50%' }} />
        )}
        <div>
          <div style={{ fontWeight: 600 }}>{user.displayName ?? user.email}</div>
          <div style={{ fontSize: 13, color: '#666' }}>{user.email}</div>
        </div>
        <button onClick={() => signOutUser()} style={{ marginLeft: 'auto' }}>
          Sign out
        </button>
      </header>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Bluetooth device</h2>

        <StatusBadge status={status} />
        {statusMessage && <p style={{ color: status === 'error' ? 'crimson' : '#666' }}>{statusMessage}</p>}

        {status === 'connected' ? (
          <>
            <p>
              <strong>{deviceName}</strong>
              <br />
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>ID: {deviceId}</span>
            </p>
            <p style={{ fontSize: 13, color: pairResult === 'error' ? 'crimson' : '#666' }}>
              Account pairing:{' '}
              {pairResult === 'pairing' ? 'saving…' : pairResult === 'paired' ? 'linked to your account' : pairResult === 'error' ? 'failed' : '—'}
            </p>
            <button onClick={handleDisconnectClick}>Disconnect</button>
          </>
        ) : (
          <button onClick={handleConnectClick} disabled={status === 'connecting'}>
            {status === 'connecting' ? 'Connecting…' : 'Connect nearby Bluetooth device'}
          </button>
        )}
      </section>

      {status === 'connected' && (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Live panel</h2>
          <form onSubmit={handleSendCommand} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              placeholder="Test command, e.g. GET_STATUS"
              style={{ flex: 1, padding: 6 }}
            />
            <button type="submit">Send</button>
          </form>
          <div style={{ background: '#f7f7f7', borderRadius: 6, padding: 8, fontFamily: 'monospace', fontSize: 12, maxHeight: 200, overflowY: 'auto' }}>
            {log.length === 0 ? <div style={{ color: '#999' }}>No activity yet.</div> : log.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const color = { disconnected: '#999', connecting: '#e0a800', connected: '#2e7d32', error: '#c62828' }[status];
  const label = { disconnected: 'Disconnected', connecting: 'Connecting…', connected: 'Connected', error: 'Error' }[status];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  );
}

function readableBluetoothError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotFoundError') return 'No compatible device was selected, or the chooser was cancelled.';
  if (name === 'SecurityError') return 'Bluetooth permission was denied.';
  if (name === 'NetworkError') return 'Could not connect to the device — make sure it is powered on and in range.';
  return 'Something went wrong connecting to the device.';
}
