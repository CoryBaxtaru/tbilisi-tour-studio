// What the guide sees when something breaks: a plain message and a way out, instead of an empty screen.
// Data is safe: it lives in the browser's storage and is not touched here.
import { Component, type ComponentChildren } from 'preact';

export function ErrorScreen({ title, detail }: { title: string; detail?: string }) {
  return (
    <main class="page error-screen">
      <div role="alert"><h1>{title}</h1></div>
      <p>Je gegevens staan nog op dit apparaat. Laad de app opnieuw; helpt dat niet, sluit de app dan helemaal en open hem weer.</p>
      <div class="row">
        <button type="button" class="btn btn--primary" onClick={() => location.reload()}>Opnieuw laden</button>
        <a class="btn" href="#/" onClick={() => setTimeout(() => location.reload(), 0)}>Naar Tours</a>
      </div>
      {detail && <p class="meta error-screen__detail">Technische melding: {detail}</p>}
    </main>
  );
}

/** Catches a crash in one page, so the rest of the app (and the menu) stays usable. */
export class ErrorBoundary extends Component<{ children: ComponentChildren; resetKey: string }, { error: string | null; key: string }> {
  state = { error: null as string | null, key: this.props.resetKey };

  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  /** Going to another page clears the error. */
  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: string | null; key: string }) {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey };
  }

  render() {
    return this.state.error !== null
      ? <ErrorScreen title="Deze pagina liep vast" detail={this.state.error} />
      : this.props.children;
  }
}
