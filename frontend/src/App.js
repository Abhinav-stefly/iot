import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function Gauge({ value = 0, min = 0, max = 100, size = 120, color = "#6ad7ff" }) {
  // draw a circular gauge using SVG
  const radius = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamp = Math.max(min, Math.min(max, Number(value) || 0));
  const pct = (clamp - min) / (max - min);
  const dash = pct * circumference;

  return (
    <svg className="gauge" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="g1" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#ff9a76" />
          <stop offset="100%" stopColor="#ff6a88" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="12" fill="none" />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke="url(#g1)"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${dash} ${circumference - dash}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="gauge-text">{value}</text>
    </svg>
  );
}

function StatCard({ title, value, unit, icon, accent, gauge }) {
  return (
    <div className={`card ${accent}`}>
      <div className="card-left">
        <div className="card-icon">{icon}</div>
        <div className="card-body">
          <div className="card-title">{title}</div>
          <div className="card-value">{value} <span className="card-unit">{unit}</span></div>
          <div className="card-actions">
            <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('openSuggestion', { detail: { metric: title.toLowerCase(), value } })); }}>Suggest</button>
          </div>
        </div>
      </div>
      <div className="card-gauge">{gauge}</div>
    </div>
  );
}

function App() {
  const [data, setData] = useState({ temp: 0, hum: 0, time: "--:--:--" });
  const [status, setStatus] = useState("Connecting...");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState({ metric: null, value: null, suggestions: [] });

  // Settings (persisted) and auto-suggest control
  const DEFAULT_SETTINGS = {
    apiBase: "http://localhost:5000",
    autoSuggest: true,
    enableActions: true,
    tempHigh: 30,
    tempLow: 5,
    humHigh: 75,
    humLow: 20,
  };
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('iot_settings');
      return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const lastAutoOpenRef = React.useRef(0);

  useEffect(() => {
    try { localStorage.setItem('iot_settings', JSON.stringify(settings)); } catch (e) {}
  }, [settings]);

  useEffect(() => {
    const fetch = () => {
      axios.get(`${settings.apiBase}/latest`, { timeout: 3000 })
        .then(res => {
          setData(res.data || {});
          setStatus("Live");
        })
        .catch(() => {
          setStatus("Disconnected");
        });
    };

    fetch();
    const interval = setInterval(fetch, 1000);
    return () => clearInterval(interval);
  }, [settings.apiBase]);

  // suggestion logic
  const getSuggestions = (temp, hum) => {
    const t = Number(temp);
    const h = Number(hum);
    const out = [];
    if (!Number.isFinite(t) || !Number.isFinite(h)) return out;

    // Temperature suggestions
    if (t >= settings.tempHigh) {
      out.push({ level: 'high', text: 'Temperature is high — consider turning on fans or cooling systems.' });
      out.push({ level: 'comfort', text: 'Open vents/windows during cooler hours.' });
    } else if (t >= Math.max(24, settings.tempHigh - 6)) {
      out.push({ level: 'warn', text: 'Temperature is warm — monitor for further increases.' });
    } else if (t <= 5) {
      out.push({ level: 'low', text: 'Temperature is very low — consider heating or insulating the space.' });
    } else {
      out.push({ level: 'ok', text: 'Temperature is within a comfortable range.' });
    }

    // Humidity suggestions
    if (h >= settings.humHigh) {
      out.push({ level: 'high', text: 'Humidity is high — use dehumidifiers or increase ventilation.' });
    } else if (h >= Math.max(settings.humHigh - 15, 55)) {
      out.push({ level: 'warn', text: 'Humidity is elevated — monitor for condensation/mold risk.' });
    } else if (h <= 20) {
      out.push({ level: 'low', text: 'Humidity is low — consider humidifiers to protect plants and materials.' });
    } else {
      out.push({ level: 'ok', text: 'Humidity is within the normal range.' });
    }

    return out;
  };

  // listen for card Suggest button events
  useEffect(() => {
    const handler = (e) => {
      const { metric, value } = e.detail || {};
      const suggestions = getSuggestions(data.temp, data.hum);
      setModalContext({ metric, value, suggestions });
      setModalOpen(true);
    };
    window.addEventListener('openSuggestion', handler);
    return () => window.removeEventListener('openSuggestion', handler);
  }, [data]);

  // Auto-open suggestions modal when readings exceed thresholds (with cooldown)
  useEffect(() => {
    if (!settings.autoSuggest) return;
    if (modalOpen) return;
    const suggestions = getSuggestions(data.temp, data.hum);
    const shouldOpen = suggestions.some(s => s.level === 'high' || s.level === 'warn');
    const now = Date.now();
    const COOLDOWN_MS = 30 * 1000;
    if (shouldOpen && (now - lastAutoOpenRef.current > COOLDOWN_MS)) {
      setModalContext({ metric: 'auto', value: null, suggestions });
      setModalOpen(true);
      lastAutoOpenRef.current = now;
    }
  }, [data, settings.autoSuggest, modalOpen]);

  return (
    <div className="app-root">
      <div className="hero">
        <div className="hero-overlay" />
        <div className="hero-inner">
          <h1>🌿 Live Environment Monitor</h1>
          <p className="hero-sub">Real-time temperature and humidity readings from your device</p>
        </div>
      </div>

      <header className="app-header compact">
        <div className="brand">
          <div className="logo">🌡️</div>
          <div>
            <h2>IoT Sensor Dashboard</h2>
            <div className={`status ${status === "Live" ? "live" : "down"}`}>{status}</div>
          </div>
        </div>
        <div className="timestamp">Last: {data.time || "—"}</div>
      </header>

      <main className="container">
        <section className="grid">
          <StatCard
            title="Temperature"
            value={data.temp ?? "--"}
            unit="°C"
            icon={<span role="img" aria-label="temp">🔥</span>}
            accent="warm"
            gauge={<Gauge value={data.temp ?? 0} min={-10} max={50} size={120} />}
          />

          <StatCard
            title="Humidity"
            value={data.hum ?? "--"}
            unit="%"
            icon={<span role="img" aria-label="hum">💧</span>}
            accent="cool"
            gauge={<Gauge value={data.hum ?? 0} min={0} max={100} size={120} color="#6ad7ff" />}
          />

          <div className="card wide scenic">
            <div className="scenic-inner">
              <img src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=60" alt="scenic" />
              <div className="scenic-caption">
                <div className="card-title">Environment Snapshot</div>
                <div className="card-value small">Live feed — updated every second. Ideal for small greenhouses and indoor monitoring.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="footer">
          <small>Data forwarded to server endpoint: <code>{settings.apiBase}/upload</code></small>
          <small>Frontend fetch: <code>{settings.apiBase}/latest</code></small>
        </section>
      </main>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Recommendations</h3>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <div className="modal-body">
              <div className="modal-context">Metric: <strong>{modalContext.metric}</strong> — Value: <strong>{
                modalContext.value ?? (
                  modalContext.metric === 'temperature' ? data.temp : (modalContext.metric === 'humidity' ? data.hum : `${data.temp}°C / ${data.hum}%`)
                )
              }</strong></div>
              <ul className="suggestions">
                {modalContext.suggestions.map((s, i) => (
                  <li key={i} className={`suggestion ${s.level}`}>
                    <div className="s-dot" />
                    <div className="s-text">{s.text}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
                <button className="btn" onClick={() => { setModalOpen(false); /* placeholder: call API or log */ }}>Acknowledge</button>
                <button className="btn btn-outline" onClick={() => { setShowSettings(true); }}>Open Settings</button>
            </div>
          </div>
        </div>
      )}

        {/* Settings modal */}
        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Settings</h3>
                <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>Close</button>
              </div>
              <div className="modal-body">
                <label className="form-row">
                  <span>API Base URL</span>
                  <input value={settings.apiBase} onChange={e => setSettings({ ...settings, apiBase: e.target.value })} />
                </label>
                <label className="form-row">
                  <span>Enable Auto-Suggest</span>
                  <input type="checkbox" checked={settings.autoSuggest} onChange={e => setSettings({ ...settings, autoSuggest: e.target.checked })} />
                </label>
                <label className="form-row">
                  <span>Enable Actions</span>
                  <input type="checkbox" checked={settings.enableActions} onChange={e => setSettings({ ...settings, enableActions: e.target.checked })} />
                </label>
                <div className="form-grid">
                  <label>
                    <span>Temp High (°C)</span>
                    <input type="number" value={settings.tempHigh} onChange={e => setSettings({ ...settings, tempHigh: Number(e.target.value) })} />
                  </label>
                  <label>
                    <span>Temp Low (°C)</span>
                    <input type="number" value={settings.tempLow} onChange={e => setSettings({ ...settings, tempLow: Number(e.target.value) })} />
                  </label>
                  <label>
                    <span>Hum High (%)</span>
                    <input type="number" value={settings.humHigh} onChange={e => setSettings({ ...settings, humHigh: Number(e.target.value) })} />
                  </label>
                  <label>
                    <span>Hum Low (%)</span>
                    <input type="number" value={settings.humLow} onChange={e => setSettings({ ...settings, humLow: Number(e.target.value) })} />
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn" onClick={() => { localStorage.setItem('iot_settings', JSON.stringify(settings)); setShowSettings(false); }}>Save</button>
                <button className="btn btn-outline" onClick={() => { setSettings(DEFAULT_SETTINGS); }}>Reset</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default App;
