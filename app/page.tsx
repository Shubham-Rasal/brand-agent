export default function Page() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 600 }}>
      <h1>OpenBrand Agent</h1>
      <p>API-only agent. Extract brand assets from any URL.</p>
      <ul>
        <li>
          <a href="/.well-known/agent-card.json">Agent Card</a>
        </li>
        <li>
          <a href="/api/health">Health</a>
        </li>
      </ul>
    </main>
  );
}
