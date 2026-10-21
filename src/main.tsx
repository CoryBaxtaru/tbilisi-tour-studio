import '@fontsource/literata/latin-400.css';
import '@fontsource/literata/latin-500.css';
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-500.css';
import { render } from 'preact';
import { init } from './state/store';
import { App } from './ui/App';
import './styles.css';

render(<App />, document.getElementById('app')!);
void init();
